// src/pages/admin/SettingsAdmin.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  ShieldCheck,
  Users,
  FileText,
  Mail,
  Settings2,
  Lock,
  Globe,
  CreditCard,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@radix-ui/react-select";

interface Category {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

interface RolePermissions {
  buyer: {
    can_post_jobs: boolean;
    can_message: boolean;
    can_book: boolean;
  };
  seller: {
    can_create_gigs: boolean;
    can_accept_bookings: boolean;
    can_message: boolean;
  };
  admin: {
    can_manage_users: boolean;
    can_approve_gigs: boolean;
    full_access: boolean;
  };
}

interface PlatformSettings {
  service_fee_percentage: number;
  payout_delay_days: number;
  min_user_age: number;
  require_id_verification: boolean;
  auto_ban_after_failed_logins: number;
  gig_auto_approval: boolean;
  flagged_keywords: string;
  enable_email_notifications: boolean;
  session_timeout_minutes: number;
  maintenance_mode: boolean;
  max_upload_size_mb: number;
  daily_gig_creation_limit: number;
  enable_2fa_enforcement: boolean;
  last_cache_clear: string | null;
  tax_rate_percentage: number;
  support_email: string;
  enable_google_login: boolean;
  enable_facebook_login: boolean;
  enable_apple_login: boolean;
  currency: string;
  default_language: string;
  webhook_urls: {
    stripe?: string;
    email_service?: string;
    analytics?: string;
  };
  categories: Category[];
  role_permissions: RolePermissions;
}

export default function SettingsAdmin() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Category editing state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Load settings
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/admin/settings", {
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        });

        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings(data);
      } catch (err: any) {
        toast.error(err.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }

      toast.success("Settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  // ────────────────────────────────────────────────
  // Category Management
  // ────────────────────────────────────────────────
  const addCategory = () => {
    if (!newCategoryName.trim()) return toast.error("Category name required");
    if (!settings) return;

    const newCat: Category = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      description: "",
      active: true,
    };

    updateSetting("categories", [...settings.categories, newCat]);
    setNewCategoryName("");
    toast.success("Category added");
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const saveEditCategory = () => {
    if (!settings || !editingCategoryId || !editingCategoryName.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }

    const updated = settings.categories.map((cat) =>
      cat.id === editingCategoryId
        ? { ...cat, name: editingCategoryName.trim() }
        : cat
    );

    updateSetting("categories", updated);
    setEditingCategoryId(null);
    setEditingCategoryName("");
    toast.success("Category updated");
  };

  const toggleCategoryActive = (id: string) => {
    if (!settings) return;
    const updated = settings.categories.map((cat) =>
      cat.id === id ? { ...cat, active: !cat.active } : cat
    );
    updateSetting("categories", updated);
  };

  const deleteCategory = (id: string) => {
    if (!settings) return;
    if (!window.confirm("Delete this category? Gigs using it may be affected.")) return;

    const updated = settings.categories.filter((cat) => cat.id !== id);
    updateSetting("categories", updated);
    toast.success("Category deleted");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-slate-900/70 border-slate-700">
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-red-400 p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Failed to load settings</h2>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Settings2 className="h-8 w-8 text-indigo-400" />
            Admin Settings
          </h1>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2 px-6 py-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Platform Fees */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-green-400" />
                Fees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Service Fee (%)</Label>
                <Input
                  type="number"
                  value={settings.service_fee_percentage}
                  onChange={(e) => updateSetting("service_fee_percentage", Number(e.target.value))}
                  min="0"
                  max="30"
                  step="0.5"
                  className="bg-slate-800 text-white border-slate-700 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={settings.tax_rate_percentage}
                  onChange={(e) => updateSetting("tax_rate_percentage", Number(e.target.value))}
                  min="0"
                  max="30"
                  step="0.1"
                  className="bg-slate-800 text-white border-slate-700 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Payout Delay (days)</Label>
                <Input
                  type="number"
                  value={settings.payout_delay_days}
                  onChange={(e) => updateSetting("payout_delay_days", Number(e.target.value))}
                  min="0"
                  max="14"
                  className="bg-slate-800 text-white border-slate-700 h-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* User & Security */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-indigo-400" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Min User Age</Label>
                <Input
                  type="number"
                  value={settings.min_user_age}
                  onChange={(e) => updateSetting("min_user_age", Number(e.target.value))}
                  min="13"
                  max="21"
                  className="bg-slate-800 text-white border-slate-700 h-9"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <Label className="text-white text-sm">Require ID Verification</Label>
                <Switch
                  checked={settings.require_id_verification}
                  onCheckedChange={(v) => updateSetting("require_id_verification", v)}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <Label className="text-white text-sm">Force 2FA (Admins)</Label>
                <Switch
                  checked={settings.enable_2fa_enforcement}
                  onCheckedChange={(v) => updateSetting("enable_2fa_enforcement", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Auto-ban after failed logins</Label>
                <Select
                  value={settings.auto_ban_after_failed_logins.toString()}
                  onValueChange={(v) => updateSetting("auto_ban_after_failed_logins", Number(v))}
                >
                  <SelectTrigger className="bg-slate-800 text-white border-slate-700 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never</SelectItem>
                    <SelectItem value="5">5 attempts</SelectItem>
                    <SelectItem value="10">10 attempts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Category Management */}
          <Card className="bg-slate-900/70 border-slate-700 md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-purple-400" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="bg-slate-800 text-white border-slate-700 h-9 flex-1"
                />
                <Button
                  onClick={addCategory}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 h-9 px-3"
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {settings.categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-md group"
                  >
                    {editingCategoryId === cat.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          autoFocus
                          className="bg-slate-700 text-white border-slate-600 h-8 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditCategory();
                            if (e.key === "Escape") cancelEditCategory();
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={saveEditCategory}
                          className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditCategory}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-1">
                          <Switch
                            checked={cat.active}
                            onCheckedChange={() => toggleCategoryActive(cat.id)}
                          />
                          <span className="text-white text-sm font-medium">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={() => startEditCategory(cat)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300"
                            onClick={() => deleteCategory(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {settings.categories.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">No categories yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Role Permissions */}
          <Card className="bg-slate-900/70 border-slate-700 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-cyan-400" />
                Role Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Buyer */}
                <div className="space-y-3">
                  <h3 className="text-white font-medium pb-1 border-b border-slate-700">Buyer</h3>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Post job requests</Label>
                    <Switch
                      checked={settings.role_permissions.buyer.can_post_jobs}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          buyer: { ...settings.role_permissions.buyer, can_post_jobs: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Message sellers</Label>
                    <Switch
                      checked={settings.role_permissions.buyer.can_message}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          buyer: { ...settings.role_permissions.buyer, can_message: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Book services</Label>
                    <Switch
                      checked={settings.role_permissions.buyer.can_book}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          buyer: { ...settings.role_permissions.buyer, can_book: v },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Seller */}
                <div className="space-y-3">
                  <h3 className="text-white font-medium pb-1 border-b border-slate-700">Seller</h3>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Create gigs</Label>
                    <Switch
                      checked={settings.role_permissions.seller.can_create_gigs}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          seller: { ...settings.role_permissions.seller, can_create_gigs: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Accept bookings</Label>
                    <Switch
                      checked={settings.role_permissions.seller.can_accept_bookings}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          seller: { ...settings.role_permissions.seller, can_accept_bookings: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Message buyers</Label>
                    <Switch
                      checked={settings.role_permissions.seller.can_message}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          seller: { ...settings.role_permissions.seller, can_message: v },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Admin */}
                <div className="space-y-3">
                  <h3 className="text-white font-medium pb-1 border-b border-slate-700">Admin</h3>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Manage users</Label>
                    <Switch
                      checked={settings.role_permissions.admin.can_manage_users}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          admin: { ...settings.role_permissions.admin, can_manage_users: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Approve gigs</Label>
                    <Switch
                      checked={settings.role_permissions.admin.can_approve_gigs}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          admin: { ...settings.role_permissions.admin, can_approve_gigs: v },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Full access</Label>
                    <Switch
                      checked={settings.role_permissions.admin.full_access}
                      onCheckedChange={(v) =>
                        updateSetting("role_permissions", {
                          ...settings.role_permissions,
                          admin: { ...settings.role_permissions.admin, full_access: v },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact & Integrations */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-cyan-400" />
                Contact & Logins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Support Email</Label>
                <Input
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => updateSetting("support_email", e.target.value)}
                  className="bg-slate-800 text-white border-slate-700 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Currency</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(v) => updateSetting("currency", v)}
                >
                  <SelectTrigger className="bg-slate-800 text-white border-slate-700 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZAR">ZAR (South African Rand)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Default Language</Label>
                <Select
                  value={settings.default_language}
                  onValueChange={(v) => updateSetting("default_language", v)}
                >
                  <SelectTrigger className="bg-slate-800 text-white border-slate-700 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="af">Afrikaans</SelectItem>
                    <SelectItem value="zu">Zulu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Social Login */}
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-400" />
                Social Login
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm">Google</Label>
                <Switch
                  checked={settings.enable_google_login}
                  onCheckedChange={(v) => updateSetting("enable_google_login", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm">Facebook</Label>
                <Switch
                  checked={settings.enable_facebook_login}
                  onCheckedChange={(v) => updateSetting("enable_facebook_login", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm">Apple</Label>
                <Switch
                  checked={settings.enable_apple_login}
                  onCheckedChange={(v) => updateSetting("enable_apple_login", v)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Save Button */}
        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2 px-8 py-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}