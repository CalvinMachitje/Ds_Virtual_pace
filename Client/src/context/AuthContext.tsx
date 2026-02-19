// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { toast } from "sonner";

type SignUpParams = {
  email: string;
  password: string;
  options?: {
    data?: {
      full_name?: string;
      phone?: string | null;
      role?: 'buyer' | 'seller';
    };
  };
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<{ data: unknown; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<{ error: Error | null }>; // Isolated admin login
  userRole: 'buyer' | 'seller' | 'admin' | null;
  isAdmin: boolean;
  adminLevel?: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | 'admin' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<string | null>(null);

  // Fetch role & admin status
  const fetchUserRoleAndAdmin = async (userId: string) => {
    try {
      console.log(`[Auth] Fetching role/admin for user: ${userId}`);

      // 1. Check admins table first
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('admin_level')
        .eq('id', userId)
        .maybeSingle();

      if (adminError) {
        console.error("[Auth] Admin table query failed:", adminError.message);
        throw adminError;
      }

      if (adminData) {
        console.log(`[Auth] User ${userId} is admin (${adminData.admin_level})`);
        setUserRole('admin');
        setIsAdmin(true);
        setAdminLevel(adminData.admin_level ?? null);
        return;
      }

      // 2. Not admin → check profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error("[Auth] Profiles table query failed:", profileError.message);
        throw profileError;
      }

      const role = (profile?.role as 'buyer' | 'seller') ?? 'buyer';
      console.log(`[Auth] User ${userId} role from profiles: ${role}`);
      setUserRole(role);
      setIsAdmin(false);
      setAdminLevel(null);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[Auth] Role/admin fetch error:", error.message);
      toast.error("Failed to load user role — defaulting to buyer");
      setUserRole('buyer');
      setIsAdmin(false);
      setAdminLevel(null);
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
        if (session?.user?.id) {
          fetchUserRoleAndAdmin(session.user.id);
        }
      })
      .catch((err: unknown) => {
        console.error("[Auth] Initial session fetch error:", err);
        setLoading(false);
      });

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchUserRoleAndAdmin(session.user.id);
      } else {
        setUserRole(null);
        setIsAdmin(false);
        setAdminLevel(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    if (!session?.user?.id) return;

    const profileChannel = supabase
      .channel(`profile-role:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const newRole = payload.new.role as 'buyer' | 'seller' | null;
          setUserRole(newRole);
          toast.info(`Your role updated to ${newRole}`);
        }
      )
      .subscribe();

    const adminChannel = supabase
      .channel(`admin-role:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admins',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setIsAdmin(false);
            setUserRole('buyer');
            setAdminLevel(null);
            toast.info("Admin access removed");
          } else if (payload.new) {
            setIsAdmin(true);
            setUserRole('admin');
            setAdminLevel(payload.new.admin_level ?? null);
            toast.info(`Admin level updated to ${payload.new.admin_level}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(adminChannel);
    };
  }, [session?.user?.id]);

  // Regular sign-up (for buyers/sellers)
  const signUp = async ({ email, password, options }: SignUpParams) => {
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: options?.data?.full_name ?? 'New User',
            phone: options?.data?.phone ?? null,
            role: options?.data?.role ?? 'buyer',
          },
        },
      });

      if (result.error) throw result.error;

      toast.success("Sign up successful! Check your email to confirm.");
      return result;

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error("Sign up failed: " + (error.message || "Unknown error"));
      return { data: null, error };
    }
  };

  // Regular sign-in (for buyers/sellers)
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      toast.success("Logged in successfully");
      return { error: null };

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error("Login failed: " + (error.message || "Invalid credentials"));
      return { error };
    }
  };

  // Isolated admin login (with extra check)
  const adminLogin = async (email: string, password: string) => {
    try {
      console.log(`[AdminLogin] Attempting login for: ${email}`);

      // 1. Authenticate with Supabase
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("[AdminLogin] Auth error:", signInError.message);
        throw signInError;
      }
      if (!user) throw new Error('No user returned from auth');

      // 2. Verify this user is in admins table
      const { data: adminRecord, error: adminError } = await supabase
        .from('admins')
        .select('id, admin_level')
        .eq('id', user.id)
        .maybeSingle();

      if (adminError) {
        console.error("[AdminLogin] Admins table error:", adminError.message);
        throw adminError;
      }

      if (!adminRecord) {
        console.warn("[AdminLogin] User not found in admins table:", user.id);
        await supabase.auth.signOut();
        throw new Error('This account does not have admin privileges.');
      }

      console.log(`[AdminLogin] Success - Admin level: ${adminRecord.admin_level}`);
      toast.success(`Welcome back, Admin (${adminRecord.admin_level})`);
      return { error: null };

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message || 'Admin login failed - check credentials');
      console.error('[AdminLogin] Full error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error("Logout failed: " + error.message);
    }
  };

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    adminLogin,           // Exposed for AdminLogin page
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