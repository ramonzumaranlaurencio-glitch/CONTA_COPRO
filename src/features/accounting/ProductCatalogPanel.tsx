import React, { useEffect, useState } from 'react';
import { Button, Input } from '@fluentui/react-components';

type Product = {
  id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  default_cost: string;
};

type ProductCatalogPanelProps = {
  token: string;
  tenantId: string;
  onSelect: (product: Product) => void;
  onClose: () => void;
};

export const ProductCatalogPanel: React.FC<ProductCatalogPanelProps> = ({ token, tenantId, onSelect, onClose }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/inventory/products?limit=500`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Id': tenantId,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [token, tenantId]);

  const filtered = products.filter(
    (p) =>
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ width: 540, maxWidth: '98vw', background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px #0002', padding: 24, zIndex: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Input placeholder="Buscar por código o descripción" value={search} onChange={(_, d) => setSearch(d.value)} style={{ flex: 1 }} />
        <Button appearance="secondary" onClick={onClose}>Cerrar</Button>
      </div>
      <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table className="erp-table" style={{ minWidth: 500 }}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}>Sin resultados</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.unit_of_measure}</td>
                <td className="money">$ {Math.round(Number(p.default_cost)).toLocaleString('es-CO')}</td>
                <td><Button appearance="primary" onClick={() => onSelect(p)}>Agregar</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
