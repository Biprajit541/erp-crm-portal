import { NavLink } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../auth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">ERP<span>+</span>CRM</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/products">Products &amp; Stock</NavLink>
          <NavLink to="/challans">Sales Challans</NavLink>
        </nav>
        <div className="side-user">
          <div className="name">{user?.name}</div>
          <div className="role-chip">{user?.role}</div>
          <button className="logout-btn" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}