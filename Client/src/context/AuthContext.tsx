// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { toast } from "sonner";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (params: { email: string; password: string; options?: { data?: { role?: 'buyer' | 'seller' } } }) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: 'buyer' | 'seller' | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) fetchUserRole(session.user.id);
    }).catch(err => {
      console.error("Session fetch error:", err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time profile role sync (if role changes in DB)
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  async function fetchUserRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserRole((data?.role as 'buyer' | 'seller') ?? 'buyer');
    } catch (err) {
      console.error("Role fetch error:", err);
      setUserRole('buyer'); // fallback
    }
  }

  const signUp = async ({ email, password, options }: { email: string; password: string; options?: { data?: { role?: 'buyer' | 'seller' } } }) => {
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...options,
          data: {
            role: options?.data?.role ?? 'buyer', // default to buyer if not specified
          },
        },
      });

      if (result.error) throw result.error;

      toast.success("Sign up successful! Check your email to confirm.");
      return result;
    } catch (err: any) {
      toast.error("Sign up failed: " + (err.message || "Unknown error"));
      return { data: null, error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      toast.success("Logged in successfully");
      return { error: null };
    } catch (err: any) {
      toast.error("Login failed: " + (err.message || "Invalid credentials"));
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
    } catch (err: any) {
      toast.error("Logout failed: " + err.message);
    }
  };

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    signOut,
    userRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};