import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import { Customer, CustomerFormModal } from "./Customers";

interface Followup {
  id: number;
  note: string;
  created_by_name: string | null;
  created_at: string;
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [c, setC] = useState<(Customer & { followups: Followup[] }) | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/customers/${id}`);
    setC(data);
  }, [id]);

  useEffect(() => { load().catch((e) => setError(errMsg(e))); }, [load]);

  const addNote = async () => {
    if (!note.trim()) return;
    setError("");
    try {
      await api.post(`/customers/${id}/followups`, { note });
      setNote("");
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (!c) return <p className="muted">{error || "Loading..."}</p>;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{c.customer_name}</h1>
        <div className="row">
          {can("SALES") && <button className="btn secondary" onClick={() => setEditing(true)}>Edit</button>}
          <Link className="btn secondary" to="/customers">Back to list</Link>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <h2>Details</h2>
        <div className="form-grid">
          <div><label>Business</label>{c.business_name || "-"}</div>
          <div><label>Mobile</label>{c.mobile}</div>
          <div><label>Email</label>{c.email || "-"}</div>
          <div><label>GST number</label>{c.gst_number || "-"}</div>
          <div><label>Type</label>{c.customer_type}</div>
          <div><label>Status</label><span className={`badge ${c.status}`}>{c.status}</span></div>
          <div><label>Follow-up date</label>{c.follow_up_date ? String(c.follow_up_date).slice(0, 10) : "-"}</div>
          <div className="full"><label>Address</label>{c.address || "-"}</div>
          <div className="full"><label>Notes</label>{c.notes || "-"}</div>
        </div>
      </div>
      <div className="card">
        <h2>Follow-up notes</h2>
        {can("SALES") && (
          <div className="row" style={{ marginBottom: 14 }}>
            <input placeholder="Write a follow-up note..." value={note}
              onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }}
              onKeyDown={(e) => e.key === "Enter" && addNote()} />
            <button className="btn" onClick={addNote}>Add note</button>
          </div>
        )}
        <div className="stack">
          {c.followups.map((f) => (
            <div key={f.id} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 12 }}>
              <div>{f.note}</div>
              <div className="muted">{f.created_by_name || "Unknown"} · {new Date(f.created_at).toLocaleString()}</div>
            </div>
          ))}
          {c.followups.length === 0 && <p className="muted">No follow-up notes yet.</p>}
        </div>
      </div>
      {editing && (
        <CustomerFormModal initial={c} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }} />
      )}
    </div>
  );
}