from sqlalchemy import text
from sqlalchemy.exc import DBAPIError


def _vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(str(float(value)) for value in embedding) + "]"

class PgVectorAccountingStore:
    def __init__(self, session):
        self.session = session

    async def _has_embedding_column(self) -> bool:
        result = await self.session.execute(text('''
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'accounting_embeddings'
                  AND column_name = 'embedding'
            )
        '''))
        return bool(result.scalar())

    async def upsert_context(self, tenant_id: str, entity_type: str, entity_id: str, content: str, embedding: list[float], metadata: dict):
        params = {
            "tenant_id": tenant_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "content": content,
            "embedding": _vector_literal(embedding),
            "metadata": metadata,
        }
        if await self._has_embedding_column():
            await self.session.execute(text('''
                INSERT INTO accounting_embeddings (tenant_id, entity_type, entity_id, content, embedding, metadata_json)
                VALUES (:tenant_id, :entity_type, :entity_id, :content, CAST(:embedding AS vector), :metadata)
            '''), params)
            return
        await self.session.execute(text('''
            INSERT INTO accounting_embeddings (tenant_id, entity_type, entity_id, content, metadata_json)
            VALUES (:tenant_id, :entity_type, :entity_id, :content, :metadata)
        '''), params)

    async def similarity_search(self, tenant_id: str, embedding: list[float], limit: int = 5):
        params = {"tenant_id": tenant_id, "embedding": _vector_literal(embedding), "limit": limit}
        if await self._has_embedding_column():
            try:
                result = await self.session.execute(text('''
                    SELECT entity_type, entity_id, content, metadata_json
                    FROM accounting_embeddings
                    WHERE tenant_id = :tenant_id
                    ORDER BY embedding <-> CAST(:embedding AS vector)
                    LIMIT :limit
                '''), params)
                return [dict(row._mapping) for row in result]
            except DBAPIError:
                await self.session.rollback()
                await self.session.execute(
                    text("SELECT set_config('app.current_tenant', :tenant_id, true)"),
                    {"tenant_id": str(tenant_id)},
                )
        result = await self.session.execute(text('''
            SELECT entity_type, entity_id, content, metadata_json
            FROM accounting_embeddings
            WHERE tenant_id = :tenant_id
            ORDER BY created_at DESC
            LIMIT :limit
        '''), params)
        return [dict(row._mapping) for row in result]

    async def get_context(self, tenant_id: str, query: str, limit: int = 8):
        result = await self.session.execute(text('''
            SELECT entity_type, entity_id, content, metadata_json
            FROM accounting_embeddings
            WHERE tenant_id = :tenant_id
            ORDER BY CASE WHEN content ILIKE :query THEN 0 ELSE 1 END, created_at DESC
            LIMIT :limit
        '''), {"tenant_id": tenant_id, "query": f"%{query}%", "limit": limit})
        return [dict(row._mapping) for row in result]
