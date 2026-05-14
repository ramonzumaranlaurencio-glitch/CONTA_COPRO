# RRHH IA Laboral

## Flujo

1. Registro: `POST /api/v1/hr/cv/extract` recibe PDF/imagen/texto de CV.
2. IA-OCR extrae datos para `Registro_Personal_V1`: nombres, apellidos, DNI, direccion, telefono, correo, profesion y experiencia.
3. Guardado: `POST /api/v1/hr/workers`.
4. Control: `GET /api/v1/hr/workers`.
5. Contrato PDF: `POST /api/v1/hr/contracts/generate`.

## Biblioteca Legal RAG

- `POST /api/v1/hr/legal-library/seed` carga referencias laborales al vector store.
- Carpeta local para anexos internos: `legal_library/`.
- Documentos base: D.L. 728, jornada/sobretiempo, SST, Ley 29733 y modelos MTPE.

## Validaciones

- DNI: 8 digitos.
- Proteccion de datos personales: alerta visible por Ley 29733.
- Validacion de domicilio: compara direccion CV vs referencia RENIEC cuando se envia `reniec_address`.
- Contratos: clausulas dinamicas por cargo, subordinacion segun D.L. 728, jornada maxima, SST, confidencialidad y datos personales.
