import React, { useEffect, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody } from '@fluentui/react-components';
import { Print24Regular, Mail24Regular, Send24Regular } from '@fluentui/react-icons';

type PrintPanelProps = {
  invoiceData: {
    serie: string;
    number: string;
    customerRuc: string;
    subtotal: string;
    igv: string;
    total: string;
    lineItems: Array<{
      productCode: string;
      description: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      lineSubtotal: string;
    }>;
  };
  customerEmail?: string;
  customerPhone?: string;
  onClose: () => void;
};

export const PrintPanel: React.FC<PrintPanelProps> = ({
  invoiceData,
  customerEmail = '',
  customerPhone = '',
  onClose,
}) => {
  const [printers, setPrinters] = useState<Array<{ name: string; ip: string }>>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [email, setEmail] = useState(customerEmail);
  const [phone, setPhone] = useState(customerPhone);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      // En producción, esto vendría de un endpoint backend
      // que escanea la red local por impresoras disponibles
      const mockPrinters = [
        { name: 'Xerox Phaser', ip: '192.168.1.100' },
        { name: 'HP LaserJet Pro', ip: '192.168.1.101' },
        { name: 'Epson WorkForce', ip: '192.168.1.102' },
      ];
      setPrinters(mockPrinters);
      if (mockPrinters.length > 0) {
        setSelectedPrinter(mockPrinters[0].name);
      }
    } catch {
      setMessage('No se pudo detectar impresoras en la red.');
    }
  };

  const generatePDF = () => {
    const doc = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 500 >>
stream
BT
/F1 12 Tf
50 800 Td
(FACTURA: ${invoiceData.serie}-${invoiceData.number}) Tj
0 -30 Td
(RUC Cliente: ${invoiceData.customerRuc}) Tj
0 -60 Td
(DETALLE DE FACTURA) Tj
0 -30 Td
(Codigo       Descripcion       U.M.       Cantidad       Precio       Total) Tj
0 -20 Td
${invoiceData.lineItems
  .map(
    (item) =>
      `(${item.productCode} ${item.description} ${item.unit} ${item.quantity} ${item.unitPrice} ${item.lineSubtotal}) Tj 0 -20 Td`
  )
  .join('\n')}
(Subtotal: S/ ${invoiceData.subtotal}) Tj
0 -20 Td
(IGV: S/ ${invoiceData.igv}) Tj
0 -20 Td
(TOTAL: S/ ${invoiceData.total}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000074 00000 n
0000000133 00000 n
0000000244 00000 n
0000000795 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
868
%%EOF
    `;
    return doc;
  };

  const handlePrint = async () => {
    if (!selectedPrinter) {
      setMessage('Selecciona una impresora primero.');
      return;
    }
    setLoading(true);
    try {
      // En producción, enviar PDF al backend para imprimir
      const pdf = generatePDF();
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      setTimeout(() => {
        iframe.contentWindow?.print();
        setMessage(`Enviando a impresora: ${selectedPrinter}`);
      }, 500);
    } catch {
      setMessage('Error al procesar la impresión.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email) {
      setMessage('Ingresa un correo válido.');
      return;
    }
    setLoading(true);
    try {
      // En producción, endpoint backend para enviar por correo
      setMessage(`Factura enviada a ${email}`);
    } catch {
      setMessage('Error al enviar correo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!phone) {
      setMessage('Ingresa un número de WhatsApp válido.');
      return;
    }
    const waUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=Tu%20factura%20${invoiceData.serie}-${invoiceData.number}%20está%20lista.`;
    window.open(waUrl, '_blank');
    setMessage('Abriendo WhatsApp...');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, background: '#f9fafb', borderRadius: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>
        Opciones de Impresión y Envío
      </div>

      {message && (
        <MessageBar intent={message.includes('Error') ? 'error' : 'info'}>
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      )}

      <Field label="Impresora disponible">
        <select
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 6,
            border: '1px solid #dbe3ed',
            fontSize: 14,
          }}
        >
          {printers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.ip})
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Button
          appearance="primary"
          icon={<Print24Regular />}
          onClick={handlePrint}
          disabled={loading}
        >
          {loading ? 'Imprimiendo...' : 'Imprimir A4'}
        </Button>
        <Button
          appearance="secondary"
          icon={<Mail24Regular />}
          onClick={handleSendEmail}
          disabled={loading}
        >
          Enviar por Correo
        </Button>
      </div>

      <Field label="Email cliente">
        <Input
          value={email}
          onChange={(_, data) => setEmail(data.value)}
          placeholder="correo@ejemplo.com"
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Button
          appearance="secondary"
          icon={<Send24Regular />}
          onClick={handleSendWhatsApp}
          disabled={loading}
        >
          Enviar por WhatsApp
        </Button>
        <Button appearance="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <Field label="Teléfono WhatsApp">
        <Input
          value={phone}
          onChange={(_, data) => setPhone(data.value)}
          placeholder="+51 999999999"
        />
      </Field>
    </div>
  );
};
