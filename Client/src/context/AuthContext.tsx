// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from "sonner";

type SignUpParams = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string | null;
  role?: 'buyer' | 'seller';
};

type AuthContextType = {
  session: any | null; // Can be your JWT payload or null
  user: any | null;    // User object from backend
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<{ error: Error | null }>;
  userRole: 'buyer' | 'seller' | 'admin' | null;
  isAdmin: boolean;
  adminLevel?: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | 'admin' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<string | null>(null);

  // Load tokens & user from localStorage on mount
  useEffect(() => {
    const loadAuth = async () => {
      setLoading(true);
      try {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          // Validate token with backend (optional but recommended)
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            setSession({ access_token: accessToken });
            setUser(data.user);
            setUserRole(data.user.role);
            setIsAdmin(data.user.role === 'admin');
            setAdminLevel(data.user.admin_level || null);
          } else {
            // Token invalid/expired → clear
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          }
        }
      } catch (err) {
        console.error("Auth load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);

  // Regular sign-up (buyer/seller)
  const signUp = async (params: SignUpParams) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // If email confirmation required
      if (data.email_confirmation_sent) {
        toast.info('Check your email to confirm your account');
        return { error: null };
      }

      // Auto-confirmed (dev mode)
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole(data.user.role);
      setIsAdmin(false);
      setAdminLevel(null);

      toast.success('Account created successfully!');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
      return { error: err };
    }
  };

  // Regular sign-in (buyer/seller)
  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole(data.user.role);
      setIsAdmin(data.user.role === 'admin');
      setAdminLevel(data.user.admin_level || null);

      toast.success('Logged in successfully');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      return { error: err };
    }
  };

  // Isolated admin login
  const adminLogin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Admin login failed');
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setSession({ access_token: data.access_token });
      setUser(data.user);
      setUserRole('admin');
      setIsAdmin(true);
      setAdminLevel(data.user.admin_level || null);

      toast.success(`Welcome back, Admin (${data.user.admin_level || 'Standard'})`);
      return { error: null };
    } catch (err: any) {
      toast.error(err.message || 'Admin login failed - check credentials');
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      // Optional: call backend logout if needed
      await fetch('/api/auth/logout', { method: 'POST' });

      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setSession(null);
      setUser(null);
      setUserRole(null);
      setIsAdmin(false);
      setAdminLevel(null);

      toast.success('Logged out successfully');
    } catch (err: any) {
      toast.error('Logout failed');
      console.error('Logout error:', err);
    }
  };

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};