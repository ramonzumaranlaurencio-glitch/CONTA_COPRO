# Deprecated purchase route variants

El archivo canónico de rutas de compras es:
- `src/api/routes/purchases.py`

Las siguientes carpetas contienen versiones antiguas o duplicadas de la lógica de compras / OCR:
- `fix_v10/`
- `fix_v11/`
- `fix_v12/`
- `fix_v13/`
- `patch_ia_compras_v2/`
- `patch_ia_criterio_v3/`
- `backups/` y sus subcarpetas relacionadas

Recomendación:
- Mantener `src/api/routes/purchases.py` como la única versión en producción.
- Archivar o borrar las carpetas anteriores cuando se confirme que ya no se usan.
