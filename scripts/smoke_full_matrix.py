from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx


@dataclass
class CheckResult:
    module: str
    check: str
    passed: bool
    status_code: int | None
    detail: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def decode_prefix(content_b64: str, max_len: int = 8) -> bytes:
    raw = base64.b64decode(content_b64.encode("ascii"))
    return raw[:max_len]


def add_result(results: list[CheckResult], module: str, check: str, passed: bool, status_code: int | None, detail: str) -> None:
    results.append(CheckResult(module=module, check=check, passed=passed, status_code=status_code, detail=detail))


def make_headers(token: str, tenant_id: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": tenant_id,
        "Content-Type": "application/json",
    }


def post_json(client: httpx.Client, url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> httpx.Response:
    return client.post(url, headers=headers, json=payload)


def get_json(client: httpx.Client, url: str, headers: dict[str, str]) -> httpx.Response:
    return client.get(url, headers=headers)


def build_report(results: list[CheckResult], meta: dict[str, str]) -> tuple[str, dict[str, Any]]:
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    lines = [
        "# Smoke Matrix Report",
        "",
        f"- Timestamp UTC: {meta['timestamp']}",
        f"- Base URL: {meta['base_url']}",
        f"- Tenant: {meta['tenant_id']}",
        f"- Total checks: {len(results)}",
        f"- Passed: {passed}",
        f"- Failed: {failed}",
        "",
        "| Module | Check | Result | HTTP | Detail |",
        "|---|---|---|---:|---|",
    ]

    for r in results:
        result = "PASS" if r.passed else "FAIL"
        code = "-" if r.status_code is None else str(r.status_code)
        detail = r.detail.replace("|", "/")
        lines.append(f"| {r.module} | {r.check} | {result} | {code} | {detail} |")

    summary = {
        "meta": meta,
        "totals": {"checks": len(results), "passed": passed, "failed": failed},
        "results": [r.__dict__ for r in results],
    }
    return "\n".join(lines) + "\n", summary


def main() -> int:
    base_url = os.getenv("SMOKE_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
    tenant_id = os.getenv("SMOKE_TENANT_ID", "11111111-1111-1111-1111-111111111111")
    user_id = os.getenv("SMOKE_USER_ID", "erp.operator")

    results: list[CheckResult] = []
    timeout = httpx.Timeout(35.0)

    with httpx.Client(timeout=timeout) as client:
        try:
            token_resp = post_json(
                client,
                f"{base_url}/auth/dev-token",
                {"tenant_id": tenant_id, "user_id": user_id, "role": "ADMIN"},
            )
            token_resp.raise_for_status()
            token = token_resp.json()["access_token"]
            add_result(results, "Auth", "dev-token", True, token_resp.status_code, "Token generado")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Auth", "dev-token", False, None, f"Error: {exc}")
            report_dir = os.path.join("docs", "smoke")
            ensure_dir(report_dir)
            meta = {"timestamp": now_iso(), "base_url": base_url, "tenant_id": tenant_id}
            report_md, report_json = build_report(results, meta)
            with open(os.path.join(report_dir, "SMOKE_LAST.md"), "w", encoding="utf-8") as f:
                f.write(report_md)
            with open(os.path.join(report_dir, "SMOKE_LAST.json"), "w", encoding="utf-8") as f:
                json.dump(report_json, f, indent=2)
            print(report_md)
            return 1

        headers = make_headers(token, tenant_id)

        # Financial pack and exports.
        try:
            r = get_json(client, f"{base_url}/reports/financial-pack?year=2026&month=5&compare_year=2025&compare_month=5", headers)
            payload = r.json() if r.status_code == 200 else {}
            compare_ok = bool(payload.get("comparison") and payload["comparison"].get("balance_sheet") and payload["comparison"].get("income_statement") and payload["comparison"].get("cash_flow"))
            add_result(results, "Reports", "financial-pack comparative", r.status_code == 200 and compare_ok, r.status_code, "comparison block completo" if compare_ok else "comparison incompleto")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Reports", "financial-pack comparative", False, None, f"Error: {exc}")

        try:
            r = get_json(client, f"{base_url}/reports/financial-pack/xlsx?year=2026&month=5&compare_year=2025&compare_month=5", headers)
            payload = r.json() if r.status_code == 200 else {}
            ok = False
            if r.status_code == 200 and payload.get("content_base64"):
                ok = decode_prefix(payload["content_base64"], 2) == b"PK"
            add_result(results, "Reports", "financial-pack xlsx", ok, r.status_code, "XLSX valido" if ok else "XLSX invalido")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Reports", "financial-pack xlsx", False, None, f"Error: {exc}")

        try:
            r = get_json(client, f"{base_url}/reports/financial-pack/pdf?year=2026&month=5&compare_year=2025&compare_month=5", headers)
            payload = r.json() if r.status_code == 200 else {}
            ok = False
            if r.status_code == 200 and payload.get("content_base64"):
                ok = decode_prefix(payload["content_base64"], 4) == b"%PDF"
            add_result(results, "Reports", "financial-pack pdf", ok, r.status_code, "PDF valido" if ok else "PDF invalido")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Reports", "financial-pack pdf", False, None, f"Error: {exc}")

        # Books lifecycle.
        try:
            r_status = get_json(client, f"{base_url}/reports/books/status?year=2026&month=5", headers)
            status_ok = r_status.status_code == 200
            add_result(results, "Books", "status", status_ok, r_status.status_code, "Estado de fuentes" if status_ok else "Fallo status")

            r_gen = post_json(client, f"{base_url}/reports/books/generate", {"year": 2026, "month": 5}, headers)
            gen_payload = r_gen.json() if r_gen.status_code == 200 else {}
            package_id = gen_payload.get("package_id")
            gen_ok = r_gen.status_code == 200 and bool(package_id)
            add_result(results, "Books", "generate", gen_ok, r_gen.status_code, f"package_id={package_id}" if package_id else "Sin package_id")

            hist = get_json(client, f"{base_url}/reports/books/packages?period=2026-05", headers)
            add_result(results, "Books", "history", hist.status_code == 200, hist.status_code, "Historial consultado")

            if package_id:
                submit = post_json(client, f"{base_url}/reports/books/packages/{package_id}/submit-sunat", {}, headers)
                submit_payload = submit.json() if submit.status_code == 200 else {}
                add_result(results, "Books", "submit-sunat", submit.status_code == 200 and bool(submit_payload.get("submission_id")), submit.status_code, submit_payload.get("submission_id", "Sin submission"))
            else:
                add_result(results, "Books", "submit-sunat", False, None, "No package_id para enviar")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Books", "lifecycle", False, None, f"Error: {exc}")

        # Inventory + COGS posting.
        try:
            suffix = uuid4().hex[:6].upper()
            p = post_json(
                client,
                f"{base_url}/inventory/products",
                {
                    "tenant_id": tenant_id,
                    "sku": f"SKU-SMK-{suffix}",
                    "name": f"Producto Smoke {suffix}",
                    "unit_of_measure": "NIU",
                    "default_cost": "10.00",
                },
                headers,
            )
            w = post_json(
                client,
                f"{base_url}/inventory/warehouses",
                {
                    "tenant_id": tenant_id,
                    "code": f"ALM-SMK-{suffix}",
                    "name": f"Almacen Smoke {suffix}",
                },
                headers,
            )
            if p.status_code == 200 and w.status_code == 200:
                product_id = p.json()["id"]
                warehouse_id = w.json()["id"]
                post_json(
                    client,
                    f"{base_url}/inventory/movements",
                    {
                        "tenant_id": tenant_id,
                        "product_id": product_id,
                        "warehouse_id": warehouse_id,
                        "movement_type": "ENTRY",
                        "qty": "5",
                        "unit_cost": "12.00",
                        "movement_reference": f"ENT-SMK-{suffix}",
                    },
                    headers,
                )
                r_exit = post_json(
                    client,
                    f"{base_url}/inventory/movements",
                    {
                        "tenant_id": tenant_id,
                        "product_id": product_id,
                        "warehouse_id": warehouse_id,
                        "movement_type": "EXIT",
                        "qty": "2",
                        "post_cost_entry": True,
                        "year": 2026,
                        "month": 5,
                        "movement_reference": f"SAL-SMK-{suffix}",
                        "source_document": f"F001-{suffix}",
                    },
                    headers,
                )
                body = r_exit.json() if r_exit.status_code == 200 else {}
                ok = r_exit.status_code == 200 and bool(body.get("cost_entry"))
                add_result(results, "Inventory", "exit with cogs", ok, r_exit.status_code, "cost_entry generado" if ok else "Sin cost_entry")
            else:
                add_result(results, "Inventory", "setup", False, p.status_code, "No se pudo crear producto/almacen")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Inventory", "exit with cogs", False, None, f"Error: {exc}")

        # Treasury + matching.
        try:
            csv_content = "date,amount,reference,currency,type\n2026-05-10,100.00,F001-000123,PEN,STATEMENT\n"
            r_import = post_json(
                client,
                f"{base_url}/finance/treasury/import-statement",
                {
                    "tenant_id": tenant_id,
                    "treasury_account_id": "22222222-2222-2222-2222-222222222222",
                    "csv_content": csv_content,
                    "default_currency": "PEN",
                },
                headers,
            )
            import_ok = r_import.status_code == 200
            add_result(results, "Treasury", "import statement", import_ok, r_import.status_code, "Importado" if import_ok else "Fallo import")

            r_match = post_json(
                client,
                f"{base_url}/finance/treasury/auto-match",
                {"tenant_id": tenant_id},
                headers,
            )
            match_ok = r_match.status_code == 200
            add_result(results, "Treasury", "auto-match", match_ok, r_match.status_code, "Auto-match ejecutado" if match_ok else "Fallo auto-match")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Treasury", "reconciliation", False, None, f"Error: {exc}")

        # SUNAT ops.
        try:
            q = get_json(client, f"{base_url}/tax/ops/queue-status", headers)
            add_result(results, "SUNAT", "queue-status", q.status_code == 200, q.status_code, "Estado de cola")
            dlq = get_json(client, f"{base_url}/tax/ops/dlq?limit=5", headers)
            add_result(results, "SUNAT", "dlq", dlq.status_code == 200, dlq.status_code, "DLQ consultada")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "SUNAT", "ops", False, None, f"Error: {exc}")

        # Integrations and AI status.
        try:
            integ = get_json(client, f"{base_url}/integrations/ops/status", headers)
            add_result(results, "Integrations", "ops-status", integ.status_code == 200, integ.status_code, "Integraciones consultadas")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "Integrations", "ops-status", False, None, f"Error: {exc}")

        try:
            ai = get_json(client, f"{base_url}/ai/config/status", headers)
            body = ai.json() if ai.status_code == 200 else {}
            ok = ai.status_code == 200 and "gemini_configured" in body
            add_result(results, "AI", "config-status", ok, ai.status_code, f"gemini_configured={body.get('gemini_configured')}")
        except Exception as exc:  # noqa: BLE001
            add_result(results, "AI", "config-status", False, None, f"Error: {exc}")

    report_dir = os.path.join("docs", "smoke")
    ensure_dir(report_dir)
    meta = {"timestamp": now_iso(), "base_url": base_url, "tenant_id": tenant_id}
    report_md, report_json = build_report(results, meta)

    md_path = os.path.join(report_dir, "SMOKE_LAST.md")
    json_path = os.path.join(report_dir, "SMOKE_LAST.json")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_json, f, indent=2)

    print(report_md)
    print(f"Report files: {md_path} | {json_path}")

    return 0 if all(r.passed for r in results) else 2


if __name__ == "__main__":
    raise SystemExit(main())
