import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import Pager from "../components/Pager";

interface Challan {
  id: number;
  challan_number: string;
  customer_name: string;
  total_quantity: number;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  created_by_name: string | null;
  created_at: string;
}

export default function Challans() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Challan[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/challans", { params: { page, search, status, limit: 10 } });
    setRows(data.data);
    setPages(data.pagination.pages);
  }, [page, search, status]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const updateStatus = async (id: number, target: "CONFIRMED" | "CANCELLED") => {
    setError(""); setOk("");
    try {
      await api.patch(`/challans/${id}/status`, { status: target });
      setOk(`Challan ${target.toLowerCase()} successfully.${target === "CONFIRMED" ? " Stock has been reduced." : ""}`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Sales Challans</h1>
        {can("SALES") && <Link className="btn" to="/challans/new">+ Create challan</Link>}
      </div>
      {error && <div className="error-box">{error}</div>}
      {ok && <div className="ok-box">{ok}</div>}
      <div className="toolbar">
        <input placeholder="Search challan no / customer..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Challan no</th><th>Customer</th><th style={{ textAlign: "right" }}>Total qty</th><th>Status</th><th>Created by</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/challans/${c.id}`}>{c.challan_number}</Link></td>
                <td>{c.customer_name}</td>
                <td className="num">{c.total_quantity}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td>{c.created_by_name || "-"}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  {c.status === "DRAFT" && can("SALES") && (
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn small" onClick={() => updateStatus(c.id, "CONFIRMED")}>Confirm</button>
                      <button className="btn danger small" onClick={() => updateStatus(c.id, "CANCELLED")}>Cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No challans found. Create a challan to record a sale.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}