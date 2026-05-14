from src.application.services.legal_rag_service import HashEmbeddingClient, chunk_legal_text


def test_hash_embedding_has_configured_dimensions_and_norm():
    embedding = HashEmbeddingClient(dimensions=16).embed("SUNAT IGV detracciones retenciones")

    assert len(embedding) == 16
    assert any(value != 0 for value in embedding)


def test_chunk_legal_text_splits_large_documents():
    content = "\n".join([f"Articulo {index}: texto legal relevante." for index in range(80)])

    chunks = chunk_legal_text(content, max_chars=250, overlap_chars=30)

    assert len(chunks) > 1
    assert all(chunk.strip() for chunk in chunks)
