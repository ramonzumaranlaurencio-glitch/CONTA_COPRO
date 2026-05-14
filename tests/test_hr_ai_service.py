from src.application.services.hr_ai_service import CvExtractionService, LaborContractGenerator


def test_cv_parser_extracts_worker_fields_and_dni():
    text = "Juan Alberto Perez Ramos, DNI 77441122, Vive en Av Larco 123. Ingeniero Senior, telefono 999888777, correo jperez@test.pe, sueldo pedido 5000"

    draft = CvExtractionService().parse_cv(text)

    assert draft.dni == "77441122"
    assert draft.telefono == "999888777"
    assert draft.email == "jperez@test.pe"
    assert draft.sueldo_pactado == 5000


def test_contract_generator_returns_pdf_base64():
    worker = {
        "nombres": "Juan",
        "apellidos": "Perez",
        "dni": "77441122",
        "direccion_domicilio": "Av Larco 123",
        "cargo_postulado": "Contador",
        "sueldo_pactado": "5000.00",
    }

    pdf_base64 = LaborContractGenerator().generate_pdf_base64(worker, "PLAZO INDETERMINADO")

    assert pdf_base64
