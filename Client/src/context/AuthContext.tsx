// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { toast } from "sonner";

const API_BASE_URL = "http://localhost:5000" ;

type SignUpParams = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string | null;
  role?: "buyer" | "seller";
};

type AuthContextType = {
  session: any | null;
  user: any | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<{ error: Error | null }>;
  userRole: "buyer" | "seller" | "admin" | null;
  isAdmin: boolean;
  adminLevel?: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"buyer" | "seller" | "admin" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<string | null>(null);

  const safeParse = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const loadAuth = async () => {
      setLoading(true);
      try {
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Session check failed: ${res.status}`);
        }

        const data = await safeParse(res);
        if (data?.user) {
          setSession({ access_token: accessToken });
          setUser(data.user);
          setUserRole(data.user.role);
          setIsAdmin(data.user.role === "admin");
          setAdminLevel(data.user.admin_level || null);
        } else {
          localStorage.clear();
        }
      } catch (err) {
        console.error("Auth init error:", err);
        localStorage.clear();
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);

  // SIGN UP
  const signUp = async (params: SignUpParams) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await safeParse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Signup failed");
      }

      if (data?.email_confirmation_sent) {
        toast.info("Check your email to confirm your account");
        return { error: null };
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole(data.user.role);
      setIsAdmin(false);
      setAdminLevel(null);

      toast.success("Account created successfully!");
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
      return { error: err };
    }
  };

  // USER LOGIN
  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeParse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Invalid credentials");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole(data.user.role);
      setIsAdmin(data.user.role === "admin");
      setAdminLevel(data.user.admin_level || null);

      toast.success("Logged in successfully");
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || "Login failed");
      return { error: err };
    }
  };

  // ADMIN LOGIN – Fixed & Improved
  const adminLogin = async (email: string, password: string) => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeParse(res);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid email or password");
        }
        if (res.status === 403) {
          throw new Error("Not an admin account");
        }
        throw new Error(data?.error || `Admin login failed (${res.status})`);
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token || "");

      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole("admin");
      setIsAdmin(true);
      setAdminLevel(data.user.admin_level || "standard");

      toast.success(`Welcome back, Admin (${data.user.admin_level || "Standard"})`);
      return { error: null };
    } catch (err: any) {
      const message = err.message || "Admin login failed. Please try again.";
      toast.error(message);
      console.error("[adminLogin] Error:", err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT
  const signOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      }).catch(() => {});

      localStorage.clear();

      setSession(null);
      setUser(null);
      setUserRole(null);
      setIsAdmin(false);
      setAdminLevel(null);

      toast.success("Logged out successfully");
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Logout failed – clearing session anyway");
      localStorage.clear();
      setSession(null);
      setUser(null);
      setUserRole(null);
      setIsAdmin(false);
      setAdminLevel(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        adminLogin,
        signOut,
        userRole,
        isAdmin,
        adminLevel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};