// src/pages/admin/AdminLogin.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { adminLogin, isAdmin, session } = useAuth();

  // Auto-redirect if already logged in as admin
  useEffect(() => {
    if (!loading && session && isAdmin) {
      console.log('[AdminLogin] Already admin - auto-redirecting');
      navigate('/admin', { replace: true });
    }
  }, [session, isAdmin, loading, navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      console.log('[AdminLogin] Attempting login with email:', email);

      const { error } = await adminLogin(email, password);

      if (error) throw error;

      // Wait for context to update (auth listener is fast)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use the latest isAdmin state
      if (isAdmin) {
        console.log('[AdminLogin] Confirmed admin - navigating');
        navigate('/admin', { replace: true });
      } else {
        // Rare fallback
        toast.warning("Admin status delayed - redirecting manually");
        navigate('/admin', { replace: true });
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(error.message || 'Admin login failed');
      console.error('[AdminLogin] Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:ml-64">
      <Card className="w-full max-w-md bg-slate-900/80 border-slate-700">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <ShieldCheck className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-2xl text-center text-white">Admin Login</CardTitle>
          <CardDescription className="text-center text-slate-400">
            Restricted access — only authorized personnel
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-slate-200">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                required
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-slate-200">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Login to Admin Panel'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Not an admin?{' '}
            <a href="/login" className="text-blue-400 hover:underline">
              Go to regular login
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}