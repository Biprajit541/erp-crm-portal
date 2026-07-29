import { createContext, useContext, useState, ReactNode } from "react";

export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";
export interface User { id: number; name: string; email: string; role: Role; }

interface AuthCtx {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = (token: string, u: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.clear();
    setUser(null);
  };
  // ADMIN can do everything
  const can = (...roles: Role[]) => !!user && (user.role === "ADMIN" || roles.includes(user.role));

  return <Ctx.Provider value={{ user, login, logout, can }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);