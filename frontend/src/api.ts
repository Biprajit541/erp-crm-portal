import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.includes("login")) {
      localStorage.clear();
      location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string; details?: { field: string; message: string }[] } } };
  const d = err.response?.data;
  if (d?.details?.length) return d.details.map((x) => `${x.field}: ${x.message}`).join(", ");
  return d?.error || "Something went wrong";
}