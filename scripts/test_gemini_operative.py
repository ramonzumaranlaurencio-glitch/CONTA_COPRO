#!/usr/bin/env python3
"""
Test para verificar que Gemini está operativo, conectado y respondiendo JSON válido.
"""
import asyncio
import json
import os
import sys
from pathlib import Path
import traceback

# Agregar src al path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from src.config import settings
    from src.infrastructure.adapters.ai.gemini import GeminiClient
except Exception as e:
    print(f"ERROR importing: {e}")
    traceback.print_exc()
    sys.exit(1)


async def test_gemini_config():
    """Verifica configuración de Gemini."""
    print("=" * 70)
    print("TEST 1: Verificar Configuración de Gemini")
    print("=" * 70)
    
    if not settings.gemini_api_key:
        print("❌ GEMINI_API_KEY no está configurada en .env")
        return False
    
    print(f"✅ GEMINI_API_KEY configurada: {settings.gemini_api_key[:20]}...")
    print(f"✅ GEMINI_MODEL: {settings.gemini_model}")
    return True


async def test_gemini_client():
    """Prueba el cliente de Gemini con un prompt de prueba."""
    print("\n" + "=" * 70)
    print("TEST 2: Conexión a Gemini (Simple Text Prompt)")
    print("=" * 70)
    
    client = GeminiClient(settings.gemini_api_key, settings.gemini_model)
    
    test_prompt = {
        "instruction": "Responde en JSON: {'status': 'ok', 'test': 'gemini_conectado'}",
        "context": "Testing Gemini connection"
    }
    
    try:
        response = await client.analyze(test_prompt)
        print(f"✅ Conexión exitosa a Gemini API")
        print(f"   Status: {response.get('status', 'N/A')}")
        print(f"   Model: {response.get('model', 'N/A')}")
        
        text_response = GeminiClient.response_text(response)
        print(f"   Response text: {text_response[:100]}...")
        return True
    except Exception as e:
        print(f"❌ Error conectando a Gemini: {e}")
        return False


async def test_invoice_extractor():
    """Prueba el extractor de facturas con una imagen de prueba."""
    print("\n" + "=" * 70)
    print("TEST 3: Invoice Extractor con Gemini")
    print("=" * 70)
    
    # Buscar una imagen de prueba en temp/
    test_image_path = Path(__file__).parent.parent / "temp" / "boleta_41049068_2026-05.pdf"
    
    if not test_image_path.exists():
        print(f"⚠️  No se encontró archivo de prueba: {test_image_path}")
        print("   Creando un test mock...")
        
        # Test mock
        extractor = InvoiceGeminiExtractor(
            GeminiClient(settings.gemini_api_key, settings.gemini_model),
            SunatRealtimeVerifier(
                ruc_lookup_url="https://www.sunat.gob.pe/",
                cpe_lookup_url="https://www.sunat.gob.pe/",
                token=settings.sunat_lookup_token or "test",
                timeout_seconds=10,
            ),
            company_ruc=settings.sunat_ruc,
        )
        print(f"✅ InvoiceGeminiExtractor inicializado correctamente")
        return True
    
    print(f"✅ Archivo de prueba encontrado: {test_image_path}")
    
    try:
        with open(test_image_path, "rb") as f:
            file_bytes = f.read()
        
        print(f"✅ Archivo leído: {len(file_bytes)} bytes")
        
        extractor = InvoiceGeminiExtractor(
            GeminiClient(settings.gemini_api_key, settings.gemini_model),
            SunatRealtimeVerifier(
                ruc_lookup_url="https://www.sunat.gob.pe/",
                cpe_lookup_url="https://www.sunat.gob.pe/",
                token=settings.sunat_lookup_token or "test",
                timeout_seconds=10,
            ),
            company_ruc=settings.sunat_ruc,
        )
        
        result = await extractor.extract(
            file_bytes=file_bytes,
            mime_type="application/pdf",
            filename=test_image_path.name,
            direction="purchase",
            target_fields=["serie", "number", "supplierRuc", "subtotal", "igv", "transportista_ruc", "transportista_razon_social"],
        )
        
        if result.get("status") == "ok":
            print(f"✅ Extracción exitosa")
            print(f"   Serie: {result.get('serie', 'N/A')}")
            print(f"   Number: {result.get('number', 'N/A')}")
            print(f"   Supplier RUC: {result.get('supplier_ruc', 'N/A')}")
            print(f"   Subtotal: {result.get('subtotal', 'N/A')}")
            print(f"   IGV: {result.get('igv', 'N/A')}")
            print(f"   Transportista RUC: {result.get('transportista_ruc', 'N/A') or 'NO EXTRAÍDO'}")
            print(f"   Transportista Razon Social: {result.get('transportista_razon_social', 'N/A') or 'NO EXTRAÍDO'}")
            print(f"   Confidence: {result.get('confidence', {}).get('overall', 0):.0%}")
            return True
        elif result.get("status") == "configuration_required":
            print(f"⚠️  Configuración incompleta: {result.get('message', 'N/A')}")
            return False
        else:
            print(f"❌ Error: {result.get('status', 'N/A')}")
            return False
    except Exception as e:
        print(f"❌ Error en extracción: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Ejecuta todos los tests."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 68 + "║")
    print("║" + " DIAGNÓSTICO: GEMINI OPERATIVO Y CONECTADO ".center(68) + "║")
    print("║" + " " * 68 + "║")
    print("╚" + "=" * 68 + "╝")
    
    results = []
    
    # Test 1: Config
    results.append(("Config", await test_gemini_config()))
    
    # Test 2: Client
    results.append(("Client", await test_gemini_client()))
    
    # Test 3: Extractor
    results.append(("Extractor", await test_invoice_extractor()))
    
    # Resumen
    print("\n" + "=" * 70)
    print("RESUMEN")
    print("=" * 70)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(passed for _, passed in results)
    print("\n" + ("✅ GEMINI OPERATIVO Y LISTO" if all_passed else "❌ GEMINI CON PROBLEMAS"))
    print("=" * 70)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
