import { useState } from "react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@erp.com");
  const [password, setPassword] = useState("Password@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">ERP<span style={{ color: "var(--brass)" }}>+</span>CRM Portal</div>
        <p className="muted">Sign in to your workspace</p>
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
        <div className="stack">
          <div>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div>
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <button className="btn" onClick={submit} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
        <div className="login-hint">
          Test accounts (password <code>Password@123</code>):<br />
          <code>admin@erp.com</code> · <code>sales@erp.com</code> · <code>warehouse@erp.com</code> · <code>accounts@erp.com</code>
        </div>
      </div>
    </div>
  );
}