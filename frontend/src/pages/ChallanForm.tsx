import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errMsg } from "../api";

interface Option { id: number; label: string; stock?: number; price?: number; }
interface Line { product_id: string; quantity: string; }

export default function ChallanForm() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers", { params: { limit: 50 } }).then((r) =>
      setCustomers(r.data.data.map((c: { id: number; customer_name: string; business_name?: string }) => ({
        id: c.id, label: c.business_name ? `${c.customer_name} (${c.business_name})` : c.customer_name,
      })))
    ).catch(() => {});
    api.get("/products", { params: { limit: 50 } }).then((r) =>
      setProducts(r.data.data.map((p: { id: number; product_name: string; sku: string; current_stock: number; unit_price: string }) => ({
        id: p.id, label: `${p.product_name} [${p.sku}]`, stock: p.current_stock, price: Number(p.unit_price),
      })))
    ).catch(() => {});
  }, []);

  const setLine = (i: number, k: keyof Line, v: string) => {
    const next = [...lines];
    next[i] = { ...next[i], [k]: v };
    setLines(next);
  };

  const totalQty = lines.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);

  const save = async (status: "DRAFT" | "CONFIRMED") => {
    setError("");
    setSaving(true);
    try {
      const items = lines
        .filter((l) => l.product_id && l.quantity)
        .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));
      await api.post("/challans", { customer_id: customerId, status, items });
      nav("/challans");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head"><h1>Create sales challan</h1></div>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div className="form-grid">
          <div className="full">
            <label>Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Products</h2>
        <div className="stack">
          {lines.map((l, i) => {
            const selected = products.find((p) => String(p.id) === l.product_id);
            return (
              <div className="row" key={i}>
                <select value={l.product_id} onChange={(e) => setLine(i, "product_id", e.target.value)} style={{ flex: 2, minWidth: 200 }}>
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <input type="number" min="1" placeholder="Qty" value={l.quantity}
                  onChange={(e) => setLine(i, "quantity", e.target.value)} style={{ width: 100 }} />
                <span className="muted" style={{ minWidth: 140 }}>
                  {selected ? `In stock: ${selected.stock} · Rs ${selected.price?.toFixed(2)}` : ""}
                </span>
                <button className="btn danger small" onClick={() => setLines(lines.filter((_, x) => x !== i))}
                  disabled={lines.length === 1}>Remove</button>
              </div>
            );
          })}
          <div>
            <button className="btn secondary small" onClick={() => setLines([...lines, { product_id: "", quantity: "" }])}>
              + Add another product
            </button>
          </div>
        </div>
      </div>
      <div className="card row">
        <strong>Total quantity: {totalQty}</strong>
        <div className="spacer" />
        <button className="btn secondary" onClick={() => save("DRAFT")} disabled={saving}>Save as draft</button>
        <button className="btn" onClick={() => save("CONFIRMED")} disabled={saving}>
          {saving ? "Saving..." : "Confirm challan (reduces stock)"}
        </button>
      </div>
      <p className="muted">The challan number is generated automatically. Confirming a challan reduces stock and will fail with a clear error if stock is insufficient.</p>
    </div>
  );
}