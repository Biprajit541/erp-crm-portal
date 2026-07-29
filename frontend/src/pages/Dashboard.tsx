import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

interface Summary {
  customers: number; products: number; low_stock: number;
  confirmed_challans: number; draft_challans: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setS(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="muted">Signed in as {user?.name} ({user?.role})</span>
      </div>
      <div className="stat-grid">
        <div className="stat"><div className="num">{s?.customers ?? "-"}</div><div className="lbl">Customers</div></div>
        <div className="stat"><div className="num">{s?.products ?? "-"}</div><div className="lbl">Products</div></div>
        <div className={`stat ${s && s.low_stock > 0 ? "alert" : ""}`}>
          <div className="num">{s?.low_stock ?? "-"}</div><div className="lbl">Low stock alerts</div>
        </div>
        <div className="stat"><div className="num">{s?.confirmed_challans ?? "-"}</div><div className="lbl">Confirmed challans</div></div>
        <div className="stat"><div className="num">{s?.draft_challans ?? "-"}</div><div className="lbl">Draft challans</div></div>
      </div>
      <div className="card">
        <h2>Quick actions</h2>
        <div className="row">
          <Link className="btn secondary" to="/customers">Manage customers</Link>
          <Link className="btn secondary" to="/products">Manage stock</Link>
          <Link className="btn" to="/challans/new">Create sales challan</Link>
        </div>
      </div>
    </div>
  );
}