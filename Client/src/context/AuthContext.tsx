// Client/src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { toast } from "sonner";
import { API_BASE_URL, SOCKET_URL } from "@/lib/api";
import { io, Socket } from "socket.io-client";
import { registerTokenHandler } from "@/lib/api";

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
  socket: Socket | null;

  // NEW: OAuth / external token login helper
  handleOAuthLogin: (data: {
    access_token: string;
    refresh_token?: string;
    user: any;
  }) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"buyer" | "seller" | "admin" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // HELPER for OAuth / external login
  const handleOAuthLogin = (data: {
    access_token: string;
    refresh_token?: string;
    user?: any;
  }) => {
    localStorage.setItem("access_token", data.access_token);

    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }

    setSession({ access_token: data.access_token });

    if (data.user) {
      setUser(data.user);
      setUserRole(data.user.role);
      setIsAdmin(data.user.role === "admin");
      setAdminLevel(data.user.admin_level || null);
    }
  };

  const safeParse = async (res: Response) => {
    try { return await res.json(); } catch { return null; }
  };

  /** Restore session from localStorage */
  useEffect(() => {
    const loadAuth = async () => {
      setLoading(true);
      try {
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) { setLoading(false); return; }

        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
        });

        const data = await safeParse(res);
        if (res.ok && data?.user) {
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
      } finally { setLoading(false); }
    };
    loadAuth();
  }, []);

  /** Refresh access token */
  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) throw new Error("No refresh token");

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await safeParse(res);
        throw new Error(err?.error || `Refresh failed (${res.status})`);
      }

      const data = await safeParse(res);
      const newAccessToken = data?.access_token;
      if (!newAccessToken) throw new Error("No new access token");

      localStorage.setItem("access_token", newAccessToken);
      setSession((prev: any) => ({ ...prev, access_token: newAccessToken }));

      console.log("[Auth] Access token refreshed");
      toast.success("Session refreshed");
      return newAccessToken;
    } catch (err: any) {
      console.error("[Auth] Refresh failed:", err.message);
      toast.error("Session expired – please log in again");
      signOut();
      return null;
    }
  };

  /** Socket.IO connection */
  useEffect(() => {
    if (!session?.access_token || !user?.id) {
      socket?.disconnect();
      setSocket(null);
      return;
    }

    if (socket?.connected || socket?.connect) return;

    const newSocket = io(SOCKET_URL, {
      query: { token: session.access_token },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log(`[Socket] CONNECTED ID: ${newSocket.id}`);
      newSocket.emit("join_buyer_room", user.id);
      toast.success("Real-time updates enabled");
    });

    newSocket.on("connect_error", async (err: any) => {
      if (err.message?.includes("token")) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          newSocket.io.opts.query = { token: newToken };
          newSocket.connect();
        }
      }
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); setSocket(null); };
  }, [session?.access_token, user?.id]);

  /** SIGN UP */
  const signUp = async (params: SignUpParams) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",
      });

      const data = await safeParse(res);
      if (!res.ok) throw new Error(data?.error || "Signup failed");

      if (data?.email_confirmation_sent) {
        toast.info("Check your email to confirm your account");
        return { error: null };
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole(data.user.role);
      toast.success("Account created successfully!");
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
      return { error: err };
    }
  };

  /** SIGN IN */
  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await safeParse(res);
      if (!res.ok) throw new Error(data?.error || "Invalid credentials");

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole(data.user.role);
      setIsAdmin(data.user.role === "admin");
      setAdminLevel(data.user.admin_level || null);

      /** 2FA required */
      if (data?.twofa_required) toast.info("Two-factor authentication required");

      toast.success("Logged in successfully");
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || "Login failed");
      return { error: err };
    }
  };

  /** ADMIN LOGIN */
  const adminLogin = async (email: string, password: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await safeParse(res);
      if (!res.ok) throw new Error(data?.error || "Admin login failed");

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
      toast.error(err.message || "Admin login failed");
      return { error: err };
    } finally { setLoading(false); }
  };

  /** LOGOUT */
  const signOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        credentials: "include",
      }).catch(() => {});
      socket?.disconnect();
      localStorage.clear();
      setSession(null); setUser(null); setUserRole(null); setIsAdmin(false); setAdminLevel(null); setSocket(null);
      toast.success("Logged out successfully");
    } catch (err) {
      console.error(err);
      localStorage.clear();
      setSession(null); setUser(null); setUserRole(null); setIsAdmin(false); setAdminLevel(null); setSocket(null);
      toast.error("Logout failed – session cleared");
    }
  };

  /** 2FA */
  const send2FA = async () => {
    await fetch(`${API_BASE_URL}/api/auth/twofa/setup`, { method: "POST", credentials: "include" });
    toast.info("2FA setup initiated – check your authenticator app");
  };
  const verify2FA = async (code: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/twofa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    });
    return res.ok;
  };

  /** OAuth */
  const startOAuth = (provider: string) => {
    window.location.href = `${API_BASE_URL}/api/auth/oauth/${provider}`;
  };
  const handleOAuthCallback = async (query: URLSearchParams) => {
    const code = query.get("code");
    const state = query.get("state");
    if (!code || !state) throw new Error("Invalid OAuth callback");

    const res = await fetch(`${API_BASE_URL}/api/auth/oauth/callback?code=${code}&state=${state}`, { credentials: "include" });
    const data = await safeParse(res);
    if (!res.ok || !data?.access_token) throw new Error(data?.error || "OAuth login failed");

    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token || "");
    setSession({ access_token: data.access_token });
    setUser(data.user);
    setUserRole(data.user.role);
    setIsAdmin(data.user.role === "admin");
    setAdminLevel(data.user.admin_level || null);

    toast.success("OAuth login successful");
  };

  // REGISTER TOKEN HANDLER HERE
  useEffect(() => {
    registerTokenHandler(handleOAuthLogin);
  }, []);

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
        socket,
        handleOAuthLogin, // expose helper
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