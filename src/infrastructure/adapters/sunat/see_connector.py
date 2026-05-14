from __future__ import annotations

import io
import zipfile
from lxml import etree
import zeep
from signxml import XMLSigner


class SunatConnectionError(Exception):
    pass


class SunatSeeConnector:
    """Conector oficial con Web Services SUNAT (OSE/SEE)."""

    def __init__(self, certificate_pfx: bytes, password: str):
        self.cert = certificate_pfx
        self.password = password
        self.wsdl_url = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService?wsdl"

    def _sign_xml(self, xml_unsigned: str) -> bytes:
        parser = etree.XMLParser(remove_blank_text=True)
        root = etree.fromstring(xml_unsigned.encode("utf-8"), parser)
        signer = XMLSigner(method="enveloped", digest_algorithm="sha256")
        signed = signer.sign(root)
        return etree.tostring(signed, encoding="utf-8", xml_declaration=True)

    @staticmethod
    def _compress(filename: str, xml_signed: bytes) -> bytes:
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(f"{filename}.xml", xml_signed)
        return zbuf.getvalue()

    @staticmethod
    def _unpack_cdr(response) -> dict:
        return {"raw": response, "status": "RECEIVED"}

    async def send_invoice(self, xml_unsigned: str, filename: str):
        signed_xml = self._sign_xml(xml_unsigned)
        zipped_file = self._compress(filename, signed_xml)

        client = zeep.Client(wsdl=self.wsdl_url)
        try:
            response = client.service.sendBill(
                fileName=f"{filename}.zip",
                contentFile=zipped_file,
            )
            return self._unpack_cdr(response)
        except Exception as exc:
            raise SunatConnectionError(f"Error de comunicacion SEE: {exc}") from exc
