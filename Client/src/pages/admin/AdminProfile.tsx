// src/pages/admin/AdminProfile.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, ShieldCheck, KeyRound, User, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface AdminProfile {
  id: string;
  email: string;
  full_name: string | null;
  admin_level: string;
  permissions: Record<string, boolean>;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminProfile() {
  const { user, session, isAdmin, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load admin profile data
  useEffect(() => {
    if (!session?.user?.id || !isAdmin) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/profile/${session.user.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load profile');
        }

        const data = await res.json();
        setProfile(data);
        setFormData(prev => ({ ...prev, full_name: data.full_name || '' }));
        setPermissions(data.permissions || {});
      } catch (err: any) {
        console.error('Profile load error:', err);
        setError(err.message || 'Failed to load admin profile');
        toast.error(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [session?.user?.id, isAdmin]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (key: string) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!session?.user?.id || !profile) return;

    // Basic client-side validation
    if (formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        return toast.error("New passwords do not match");
      }
      if (formData.newPassword.length < 8) {
        return toast.error("New password must be at least 8 characters");
      }
    }

    setSaving(true);

    try {
      const payload: any = {
        full_name: formData.full_name.trim(),
        permissions,
      };

      if (formData.newPassword) {
        payload.new_password = formData.newPassword;
        // Optional: send current password if backend requires it
        // payload.current_password = formData.currentPassword;
      }

      const res = await fetch(`/api/admin/profile/${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
      }

      const updated = await res.json();
      setProfile(updated);
      setFormData({
        full_name: updated.full_name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      toast.success('Profile updated successfully');
    } catch (err: any) {
      console.error('Profile update error:', err);
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading admin profile...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center space-y-4">
          <ShieldCheck className="h-16 w-16 mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-slate-400 max-w-md">
            This page is restricted to administrators only.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center space-y-6 max-w-md">
          <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">Error Loading Profile</h2>
          <p className="text-slate-400">{error}</p>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="h-10 w-10 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Admin Profile</h1>
          </div>
          <div className="text-sm text-slate-400">
            Last login: {profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}
          </div>
        </div>

        <Separator className="bg-slate-700" />

        <div className="grid gap-8 md:grid-cols-2">
          {/* Basic Info */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-slate-800 border-slate-700 text-slate-300 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-slate-200">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Admin Level</Label>
                <div className="px-4 py-2 bg-blue-950/50 border border-blue-800 rounded-md text-blue-300 font-medium inline-block">
                  {profile.admin_level.toUpperCase()}
                </div>
              </div>

              <div className="pt-4">
                <p className="text-sm text-slate-400">
                  Member since: {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="text-slate-400">
                Leave blank if not changing password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-slate-200">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-200">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Confirm new password"
                />
                {formData.newPassword && formData.newPassword !== formData.confirmPassword && (
                  <p className="text-sm text-red-400">Passwords do not match</p>
                )}
              </div>

              <div className="pt-2">
                <p className="text-xs text-slate-500">
                  Password requirements: minimum 8 characters, mix of letters, numbers, and symbols recommended.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Permissions Management */}
          <Card className="bg-slate-900/70 border-slate-700 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Admin Permissions
              </CardTitle>
              <CardDescription className="text-slate-400">
                Toggle permissions for this admin account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(permissions).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No permissions configured for this admin level</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(permissions).map(([key, value]) => (
                    <div 
                      key={key} 
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800/70 transition-colors"
                    >
                      <div>
                        <Label htmlFor={`perm-${key}`} className="text-slate-200 capitalize font-medium">
                          {key.replace(/_/g, ' ')}
                        </Label>
                        <p className="text-xs text-slate-500 mt-1">
                          {value ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      <Switch
                        id={`perm-${key}`}
                        checked={value}
                        onCheckedChange={() => handlePermissionToggle(key)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-10 flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 min-w-[160px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}