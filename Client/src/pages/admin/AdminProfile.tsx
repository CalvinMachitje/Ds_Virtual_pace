// src/pages/admin/AdminProfile.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, ShieldCheck, KeyRound, User } from 'lucide-react';
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

  // Load admin profile data from Flask API
  useEffect(() => {
    if (!session?.user?.id || !isAdmin) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/profile/${session.user.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load profile');
        }

        const data = await res.json();
        setProfile(data);
        setFormData(prev => ({ ...prev, full_name: data.full_name || '' }));
        setPermissions(data.permissions || {});
      } catch (err: any) {
        toast.error(err.message || 'Failed to load admin profile');
        console.error('Profile load error:', err);
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

    setSaving(true);

    try {
      const res = await fetch(`/api/admin/profile/${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          permissions,
          ...(formData.newPassword && {
            new_password: formData.newPassword,
            confirm_password: formData.confirmPassword,
          }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
      }

      const updated = await res.json();
      setProfile(updated);
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
      console.error('Profile update error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAdmin || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center">
          <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400">This page is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <ShieldCheck className="h-10 w-10 text-blue-500" />
          <h1 className="text-3xl font-bold text-white">Admin Profile</h1>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Basic Info Card */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your admin profile details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email (cannot be changed)</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-slate-800 border-slate-700 text-slate-300"
                />
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
                <div className="px-4 py-2 bg-blue-950/50 border border-blue-800 rounded-md text-blue-300 font-medium">
                  {profile.admin_level.toUpperCase()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change Card */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="text-slate-400">
                Leave blank if not changing
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
                  placeholder="Enter new password"
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
              </div>
            </CardContent>
          </Card>

          {/* Permissions Card */}
          <Card className="bg-slate-900/70 border-slate-700 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Admin Permissions
              </CardTitle>
              <CardDescription className="text-slate-400">
                Control what this admin account can do
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <Label htmlFor={`perm-${key}`} className="text-slate-200 capitalize">
                      {key}
                    </Label>
                    <Switch
                      id={`perm-${key}`}
                      checked={value}
                      onCheckedChange={() => handlePermissionToggle(key)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-10 flex justify-end">
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