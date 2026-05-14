from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
import json
import math
import re
from uuid import uuid4


LEGAL_DOCUMENT_ENTITY = "LEGAL_DOCUMENT"


def chunk_legal_text(content: str, *, max_chars: int = 1400, overlap_chars: int = 160) -> list[str]:
    normalized = "\n".join(line.strip() for line in content.splitlines() if line.strip())
    if not normalized:
        return []

    chunks: list[str] = []
    cursor = 0
    while cursor < len(normalized):
        end = min(cursor + max_chars, len(normalized))
        if end < len(normalized):
            boundary = normalized.rfind("\n", cursor, end)
            if boundary <= cursor:
                boundary = normalized.rfind(" ", cursor, end)
            if boundary > cursor:
                end = boundary
        chunk = normalized[cursor:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break
        cursor = max(end - overlap_chars, cursor + 1)
    return chunks


class HashEmbeddingClient:
    """Deterministic local embeddings for offline/legal batch ingestion."""

    def __init__(self, dimensions: int = 768) -> None:
        self.dimensions = dimensions

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = re.findall(r"[\w]+", text.lower(), flags=re.UNICODE)
        for token in tokens:
            digest = sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            vector[0] = 1.0
            return vector
        return [round(value / norm, 8) for value in vector]


@dataclass
class LegalDocumentInput:
    source_id: str
    title: str
    content: str
    metadata: dict = field(default_factory=dict)


@dataclass
class LegalBatchResult:
    provider: str
    documents: int
    chunks: int
    warnings: list[str] = field(default_factory=list)


class ChromaLegalStore:
    def __init__(self, *, persist_directory: str, collection_name: str) -> None:
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self._collection = None
        self._import_error: str | None = None

        try:
            import chromadb

            client = chromadb.PersistentClient(path=persist_directory)
            self._collection = client.get_or_create_collection(collection_name)
        except Exception as exc:
            self._import_error = str(exc)

    @property
    def available(self) -> bool:
        return self._collection is not None

    @property
    def import_error(self) -> str | None:
        return self._import_error

    async def upsert_context(self, tenant_id: str, entity_type: str, entity_id: str, content: str, embedding: list[float], metadata: dict):
        if self._collection is None:
            raise RuntimeError(self._import_error or "ChromaDB no disponible")
        chroma_metadata = self._chroma_safe_metadata({"tenant_id": tenant_id, "entity_type": entity_type, "entity_id": entity_id, **metadata})
        self._collection.upsert(
            ids=[f"{tenant_id}:{entity_type}:{entity_id}"],
            embeddings=[embedding],
            documents=[content],
            metadatas=[chroma_metadata],
        )

    async def similarity_search(self, tenant_id: str, embedding: list[float], limit: int = 5):
        if self._collection is None:
            raise RuntimeError(self._import_error or "ChromaDB no disponible")
        result = self._collection.query(
            query_embeddings=[embedding],
            n_results=limit,
            where={"tenant_id": tenant_id},
            include=["documents", "metadatas", "distances"],
        )
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        rows = []
        for content, metadata, distance in zip(documents, metadatas, distances):
            metadata = metadata or {}
            rows.append(
                {
                    "entity_type": metadata.get("entity_type", LEGAL_DOCUMENT_ENTITY),
                    "entity_id": metadata.get("entity_id"),
                    "content": content,
                    "metadata_json": metadata,
                    "distance": distance,
                }
            )
        return rows

    def _chroma_safe_metadata(self, metadata: dict) -> dict:
        safe = {}
        for key, value in metadata.items():
            if value is None or isinstance(value, (str, int, float, bool)):
                safe[str(key)] = value
            else:
                safe[str(key)] = json.dumps(value, ensure_ascii=False)
        return safe


class LegalRagService:
    def __init__(
        self,
        *,
        pgvector_store,
        chroma_store: ChromaLegalStore | None,
        vector_provider: str,
        embedding_client: HashEmbeddingClient,
    ) -> None:
        self.pgvector_store = pgvector_store
        self.chroma_store = chroma_store
        self.vector_provider = (vector_provider or "pgvector").lower()
        self.embedding_client = embedding_client

    def connection_status(self) -> dict:
        chroma_available = bool(self.chroma_store and self.chroma_store.available)
        return {
            "provider": self.vector_provider,
            "pgvector_configured": self.pgvector_store is not None,
            "chromadb_configured": chroma_available,
            "chromadb_error": None if chroma_available else (self.chroma_store.import_error if self.chroma_store else None),
            "embedding_dimensions": self.embedding_client.dimensions,
        }

    async def load_legal_documents(self, tenant_id: str, documents: list[LegalDocumentInput]) -> LegalBatchResult:
        store, provider, warnings = self._select_store_for_write()
        chunk_count = 0
        for document in documents:
            chunks = chunk_legal_text(document.content)
            for index, chunk in enumerate(chunks):
                entity_id = f"{document.source_id}#{index + 1}"
                metadata = self._metadata(document, index=index, chunks=len(chunks), provider=provider)
                await store.upsert_context(
                    tenant_id,
                    LEGAL_DOCUMENT_ENTITY,
                    entity_id,
                    chunk,
                    self.embedding_client.embed(chunk),
                    metadata,
                )
                chunk_count += 1
        return LegalBatchResult(provider=provider, documents=len(documents), chunks=chunk_count, warnings=warnings)

    async def query(self, tenant_id: str, question: str, *, limit: int = 5) -> dict:
        store, provider, warnings = self._select_store_for_read()
        embedding = self.embedding_client.embed(question)
        rows = await store.similarity_search(tenant_id, embedding, limit=limit)
        legal_rows = [row for row in rows if row.get("entity_type") == LEGAL_DOCUMENT_ENTITY]
        return {"provider": provider, "results": legal_rows[:limit], "warnings": warnings}

    def _select_store_for_write(self):
        warnings: list[str] = []
        if self.vector_provider in {"chroma", "chromadb"}:
            if self.chroma_store and self.chroma_store.available:
                return self.chroma_store, "chromadb", warnings
            warnings.append(f"ChromaDB no disponible; fallback pgvector: {self.chroma_store.import_error if self.chroma_store else 'sin store'}")
        return self.pgvector_store, "pgvector", warnings

    def _select_store_for_read(self):
        return self._select_store_for_write()

    def _metadata(self, document: LegalDocumentInput, *, index: int, chunks: int, provider: str) -> dict:
        metadata = self._json_safe(document.metadata)
        metadata.update(
            {
                "source_id": document.source_id,
                "title": document.title,
                "chunk_index": index + 1,
                "chunk_count": chunks,
                "rag_provider": provider,
                "batch_id": str(uuid4()),
            }
        )
        return metadata

    def _json_safe(self, value):
        if isinstance(value, dict):
            return {str(key): self._json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._json_safe(item) for item in value]
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        return str(value)
