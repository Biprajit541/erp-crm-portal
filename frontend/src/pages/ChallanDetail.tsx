import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, errMsg } from "../api";

interface Item { id: number; product_name: string; sku: string; unit_price: string; quantity: number; }
interface Challan {
  id: number; challan_number: string; customer_name: string; business_name: string | null;
  mobile: string; total_quantity: number; status: string; created_by_name: string | null;
  created_at: string; items: Item[];
}

export default function ChallanDetail() {
  const { id } = useParams();
  const [c, setC] = useState<Challan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/challans/${id}`).then((r) => setC(r.data)).catch((e) => setError(errMsg(e)));
  }, [id]);

  if (!c) return <p className="muted">{error || "Loading..."}</p>;
  const totalValue = c.items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{c.challan_number}</h1>
        <Link className="btn secondary" to="/challans">Back to list</Link>
      </div>
      <div className="card">
        <div className="form-grid">
          <div><label>Customer</label>{c.customer_name}{c.business_name ? ` (${c.business_name})` : ""}</div>
          <div><label>Mobile</label>{c.mobile}</div>
          <div><label>Status</label><span className={`badge ${c.status}`}>{c.status}</span></div>
          <div><label>Created by</label>{c.created_by_name || "-"}</div>
          <div><label>Created on</label>{new Date(c.created_at).toLocaleString()}</div>
          <div><label>Total quantity</label>{c.total_quantity}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Product (snapshot)</th><th>SKU</th><th style={{ textAlign: "right" }}>Unit price (Rs)</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Line total (Rs)</th></tr>
          </thead>
          <tbody>
            {c.items.map((i) => (
              <tr key={i.id}>
                <td>{i.product_name}</td>
                <td>{i.sku}</td>
                <td className="num">{Number(i.unit_price).toFixed(2)}</td>
                <td className="num">{i.quantity}</td>
                <td className="num">{(Number(i.unit_price) * i.quantity).toFixed(2)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4}><strong>Total value</strong></td>
              <td className="num"><strong>{totalValue.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">Prices shown are the snapshot captured when the challan was created - later product price changes do not affect this challan.</p>
    </div>
  );
}