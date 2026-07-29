import { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import Pager from "../components/Pager";

interface Product {
  id: number;
  product_name: string;
  sku: string;
  category: string | null;
  unit_price: string;
  current_stock: number;
  min_stock_alert: number;
  location: string | null;
}

interface Movement {
  id: number;
  quantity: number;
  movement_type: "IN" | "OUT";
  reason: string;
  created_by_name: string | null;
  created_at: string;
}

const emptyP = { product_name: "", sku: "", category: "", unit_price: "", current_stock: "0", min_stock_alert: "0", location: "" };

function ProductModal({ initial, onClose, onSaved }: {
  initial: Product | null; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>(
    initial
      ? Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v == null ? "" : String(v)]))
      : { ...emptyP }
  );
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setError("");
    try {
      if (initial) await api.put(`/products/${initial.id}`, f);
      else await api.post("/products", f);
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? "Edit product" : "Add product"}</h2>
        {error && <div className="error-box">{error}</div>}
        <div className="form-grid">
          <div><label>Product name *</label><input value={f.product_name} onChange={set("product_name")} /></div>
          <div><label>SKU / code *</label><input value={f.sku} onChange={set("sku")} /></div>
          <div><label>Category</label><input value={f.category} onChange={set("category")} /></div>
          <div><label>Unit price (Rs) *</label><input type="number" min="0" step="0.01" value={f.unit_price} onChange={set("unit_price")} /></div>
          {!initial && <div><label>Opening stock</label><input type="number" min="0" value={f.current_stock} onChange={set("current_stock")} /></div>}
          <div><label>Minimum stock alert</label><input type="number" min="0" value={f.min_stock_alert} onChange={set("min_stock_alert")} /></div>
          <div className="full"><label>Location / warehouse</label><input value={f.location} onChange={set("location")} /></div>
        </div>
        {initial && <p className="muted" style={{ marginTop: 10 }}>Stock is changed through stock movements, not by editing the product.</p>}
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save product</button>
        </div>
      </div>
    </div>
  );
}

function MovementModal({ product, onClose, onSaved }: {
  product: Product; onClose: () => void; onSaved: () => void;
}) {
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    try {
      await api.post("/products/movements", {
        product_id: product.id, quantity: qty, movement_type: type, reason,
      });
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Stock movement · {product.product_name}</h2>
        <p className="muted">Current stock: {product.current_stock}</p>
        {error && <div className="error-box">{error}</div>}
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div>
            <label>Movement type</label>
            <select value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")}>
              <option value="IN">IN (stock received)</option>
              <option value="OUT">OUT (stock removed)</option>
            </select>
          </div>
          <div><label>Quantity *</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="full"><label>Reason *</label><input placeholder="e.g. Purchase order received, damaged goods..." value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Record movement</button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  useEffect(() => {
    api.get(`/products/${product.id}`).then((r) => setMovements(r.data.movements)).catch(() => {});
  }, [product.id]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Movement log · {product.product_name}</h2>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Type</th><th>Qty</th><th>Reason</th><th>By</th><th>When</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td><span className={`badge ${m.movement_type}`}>{m.movement_type}</span></td>
                  <td className="num">{m.quantity}</td>
                  <td>{m.reason}</td>
                  <td>{m.created_by_name || "-"}</td>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={5} className="muted">No movements recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="modal-actions"><button className="btn secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export default function Products() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [modal, setModal] = useState<
    { kind: "add" } | { kind: "edit"; p: Product } | { kind: "move"; p: Product } | { kind: "log"; p: Product } | null
  >(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/products", { params: { page, search, lowStock: lowStock || undefined, limit: 10 } });
    setRows(data.data);
    setPages(data.pagination.pages);
  }, [page, search, lowStock]);

  useEffect(() => { load().catch(() => {}); }, [load]);
  const done = () => { setModal(null); load(); };

  return (
    <div>
      <div className="page-head">
        <h1>Products &amp; Stock</h1>
        {can("WAREHOUSE") && <button className="btn" onClick={() => setModal({ kind: "add" })}>+ Add product</button>}
      </div>
      <div className="toolbar">
        <input placeholder="Search product / SKU..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={lowStock}
            onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} />
          Low stock only
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Category</th><th style={{ textAlign: "right" }}>Price (Rs)</th><th style={{ textAlign: "right" }}>Stock</th><th>Location</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.product_name}</td>
                <td>{p.sku}</td>
                <td>{p.category || "-"}</td>
                <td className="num">{Number(p.unit_price).toFixed(2)}</td>
                <td className="num">
                  {p.current_stock}{" "}
                  {p.current_stock <= p.min_stock_alert && <span className="badge low">LOW</span>}
                </td>
                <td>{p.location || "-"}</td>
                <td>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button className="btn secondary small" onClick={() => setModal({ kind: "log", p })}>Log</button>
                    {can("WAREHOUSE") && <>
                      <button className="btn secondary small" onClick={() => setModal({ kind: "edit", p })}>Edit</button>
                      <button className="btn small" onClick={() => setModal({ kind: "move", p })}>Stock +/-</button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No products found. Add a product to start tracking stock.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
      {modal?.kind === "add" && <ProductModal initial={null} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "edit" && <ProductModal initial={modal.p} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "move" && <MovementModal product={modal.p} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === "log" && <HistoryModal product={modal.p} onClose={() => setModal(null)} />}
    </div>
  );
}
