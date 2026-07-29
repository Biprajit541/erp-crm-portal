import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import Pager from "../components/Pager";

export interface Customer {
  id: number;
  customer_name: string;
  mobile: string;
  email: string | null;
  business_name: string | null;
  gst_number: string | null;
  customer_type: "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";
  address: string | null;
  status: "LEAD" | "ACTIVE" | "INACTIVE";
  follow_up_date: string | null;
  notes: string | null;
}

const empty = {
  customer_name: "", mobile: "", email: "", business_name: "", gst_number: "",
  customer_type: "RETAIL", address: "", status: "LEAD", follow_up_date: "", notes: "",
};

export function CustomerFormModal({ initial, onClose, onSaved }: {
  initial: Partial<Customer> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({
    ...empty,
    ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v == null ? "" : String(v)])),
    follow_up_date: initial?.follow_up_date ? String(initial.follow_up_date).slice(0, 10) : "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      if (initial?.id) await api.put(`/customers/${initial.id}`, f);
      else await api.post("/customers", f);
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial?.id ? "Edit customer" : "Add customer"}</h2>
        {error && <div className="error-box">{error}</div>}
        <div className="form-grid">
          <div><label>Customer name *</label><input value={f.customer_name} onChange={set("customer_name")} /></div>
          <div><label>Mobile (10 digits) *</label><input value={f.mobile} onChange={set("mobile")} /></div>
          <div><label>Email</label><input value={f.email} onChange={set("email")} /></div>
          <div><label>Business name</label><input value={f.business_name} onChange={set("business_name")} /></div>
          <div><label>GST number (optional)</label><input value={f.gst_number} onChange={set("gst_number")} /></div>
          <div>
            <label>Customer type *</label>
            <select value={f.customer_type} onChange={set("customer_type")}>
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={f.status} onChange={set("status")}>
              <option value="LEAD">Lead</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div><label>Follow-up date</label><input type="date" value={f.follow_up_date} onChange={set("follow_up_date")} /></div>
          <div className="full"><label>Address</label><textarea value={f.address} onChange={set("address")} /></div>
          <div className="full"><label>Notes</label><textarea value={f.notes} onChange={set("notes")} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save customer"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [editing, setEditing] = useState<Partial<Customer> | null | false>(false);

  const load = useCallback(async () => {
    const { data } = await api.get("/customers", { params: { page, search, status, type, limit: 10 } });
    setRows(data.data);
    setPages(data.pagination.pages);
  }, [page, search, status, type]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  return (
    <div>
      <div className="page-head">
        <h1>Customers</h1>
        {can("SALES") && <button className="btn" onClick={() => setEditing(null)}>+ Add customer</button>}
      </div>
      <div className="toolbar">
        <input placeholder="Search name / mobile / business..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Business</th><th>Mobile</th><th>Type</th><th>Status</th><th>Follow-up</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/customers/${c.id}`}>{c.customer_name}</Link></td>
                <td>{c.business_name || "-"}</td>
                <td>{c.mobile}</td>
                <td>{c.customer_type}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td>{c.follow_up_date ? String(c.follow_up_date).slice(0, 10) : "-"}</td>
                <td>{can("SALES") && <button className="btn secondary small" onClick={() => setEditing(c)}>Edit</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No customers found. Add your first customer to get started.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
      {editing !== false && (
        <CustomerFormModal initial={editing} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }} />
      )}
    </div>
  );
}