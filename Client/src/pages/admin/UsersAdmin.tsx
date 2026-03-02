// src/pages/admin/UsersAdmin.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Ban,
  UserCheck,
  UserX,
  AlertCircle,
  Eye,
  Users,
  X,
  Download,
  FileText,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  full_name: string | null;
  email: string;
  role: "buyer" | "seller";
  created_at: string;
  is_verified: boolean;
  is_online: boolean;
  rating: number | null;
  review_count: number | null;
  banned: boolean | null;
  evidence_url?: string | null;
};

type Verification = {
  id: string;
  seller_id: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  evidence_urls: string[];
  submitted_at: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type SellerProfile = {
  full_name: string | null;
  email: string;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  portfolio_images?: string[];
  average_rating: number;
  review_count: number;
  is_online: boolean;
  created_at: string;
};

type SortConfig = {
  key: keyof User;
  direction: "asc" | "desc";
};

export default function UsersAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller">("all");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    type: "ban" | "unban" | "verify" | "unverify" | "delete";
    userIds: string[];
  } | null>(null);

  const [reviewSeller, setReviewSeller] = useState<User | null>(null);
  const [sellerVerification, setSellerVerification] = useState<Verification | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  const pageSize = 10;

  // Fetch all users
  const { data: usersResponse = {}, isLoading: usersLoading, error: usersError } = useQuery<any>({
    queryKey: ["admin-users", page, searchTerm, roleFilter],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter !== "all" && { role: roleFilter }),
      });

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    refetchInterval: 30000, // real-time polling
  });

  const users: User[] = usersResponse.users || [];
  const totalUsers = usersResponse.total || 0;

  // Fetch pending verifications
  const { data: pendingVerifs = [], isLoading: verifsLoading, error: verifsError } = useQuery<Verification[]>({
    queryKey: ["pending-verifications"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/admin/verifications/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load pending verifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(u =>
        u.full_name?.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter(u => u.role === roleFilter);
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? (typeof a[sortConfig.key] === "number" ? 0 : "");
        const bVal = b[sortConfig.key] ?? (typeof b[sortConfig.key] === "number" ? 0 : "");

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, searchTerm, roleFilter, sortConfig]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  // Mutations
  const queryClientRef = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Action completed");
      queryClientRef.invalidateQueries({ queryKey: ["admin-users"] });
      queryClientRef.invalidateQueries({ queryKey: ["pending-verifications"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ action, userIds }: { action: string; userIds: string[] }) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/admin/users/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, userIds }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Bulk action completed");
      queryClientRef.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedUsers([]);
    },
    onError: (err: any) => toast.error(err.message || "Bulk action failed"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("User deleted");
      queryClientRef.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const handleReviewSeller = async (user: User) => {
    setReviewSeller(user);
    setRejectReason("");

    try {
      const token = localStorage.getItem("access_token");

      // Fetch verification
      const verRes = await fetch(`/api/admin/verifications/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (verRes.ok) {
        const verData = await verRes.json();
        setSellerVerification(verData);
      }

      // Fetch full profile
      const profileRes = await fetch(`/api/admin/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setSellerProfile(profileData);
      }
    } catch (err) {
      toast.error("Failed to load seller details");
    }
  };

  const handleApprove = () => {
    if (!sellerVerification?.id) return;
    updateUserMutation.mutate(
      { userId: reviewSeller!.id, action: "verify" },
      {
        onSuccess: () => {
          setReviewSeller(null);
          setSellerVerification(null);
          setSellerProfile(null);
        },
      }
    );
  };

  const handleReject = () => {
    if (!sellerVerification?.id || !rejectReason.trim()) {
      toast.warning("Please provide a rejection reason");
      return;
    }

    const token = localStorage.getItem("access_token");
    fetch(`/api/admin/verifications/${sellerVerification.id}/reject`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rejection_reason: rejectReason.trim() }),
    })
      .then(res => {
        if (!res.ok) throw new Error("Reject failed");
        return res.json();
      })
      .then(() => {
        toast.success("Verification rejected");
        queryClient.invalidateQueries({ queryKey: ["pending-verifications"] });
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        setReviewSeller(null);
        setSellerVerification(null);
        setSellerProfile(null);
        setRejectReason("");
      })
      .catch(err => toast.error(err.message || "Failed to reject"));
  };

  const handleDelete = (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    deleteUserMutation.mutate(userId);
  };

  const viewProfile = (user: User) => {
    const path =
      user.role === "buyer" ? `/profile/${user.id}` :
      user.role === "seller" ? `/seller-profile/${user.id}` :
      `/admin/users/${user.id}`;
    navigate(path);
  };

  if (usersError || verifsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">Error Loading Data</h2>
          <p className="text-slate-400">{(usersError as Error)?.message || (verifsError as Error)?.message}</p>
          <Button onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["pending-verifications"] });
          }}>Retry</Button>
        </div>
      </div>
    );
  }

  function toggleSelectUser(id: string): void {
    throw new Error("Function not implemented.");
  }

  function handleSingleAction(id: string, arg1: string): void {
    throw new Error("Function not implemented.");
  }

  function executeBulkAction(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault(); 

    if (!confirmAction) return;

    // Call your bulk mutation here (from your existing code)
    bulkUpdateMutation.mutate(
      { action: confirmAction.type, userIds: confirmAction.userIds },
      {
        onSuccess: () => {
          setConfirmAction(null);
          // Optional: close dialog or reset selection
        },
        onError: (err: any) => {
          toast.error(err.message || "Bulk action failed");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            Manage Users
          </h1>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[140px] justify-between">
                  {roleFilter === "all" ? "All Roles" : roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-white">
                <DropdownMenuItem onClick={() => { setRoleFilter("all"); setPage(1); }}>All Roles</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRoleFilter("buyer"); setPage(1); }}>Buyers</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRoleFilter("seller"); setPage(1); }}>Sellers</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Users Table */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-lg">
                No users found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                          onCheckedChange={() => {
                            if (selectedUsers.length === paginatedUsers.length) {
                              setSelectedUsers([]);
                            } else {
                              setSelectedUsers(paginatedUsers.map(u => u.id));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Banned</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(u.id)}
                            onCheckedChange={() => toggleSelectUser(u.id)}
                          />
                        </TableCell>
                        <TableCell>{u.full_name || "Unnamed"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.is_verified ? "default" : "secondary"}>
                            {u.is_verified ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.banned ? "destructive" : "outline"}>
                            {u.banned ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => viewProfile(u)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSingleAction(u.id, u.banned ? "unban" : "ban")}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDelete(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredUsers.length > 0 && (
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Action Confirmation */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} {confirmAction?.userIds.length} users?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className={cn(
                confirmAction?.type.includes("ban") || confirmAction?.type === "unverify"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seller Verification Review Modal */}
      <Dialog open={!!reviewSeller} onOpenChange={() => {
        setReviewSeller(null);
        setSellerVerification(null);
        setSellerProfile(null);
        setRejectReason("");
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Seller Verification Review
              <Button variant="ghost" size="icon" onClick={() => {
                setReviewSeller(null);
                setSellerVerification(null);
                setSellerProfile(null);
              }}>
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {reviewSeller && sellerVerification && (
            <div className="space-y-8 pt-4">
              {/* Seller Profile Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                  <div className="text-center">
                    <img
                      src={sellerProfile?.avatar_url || "/default-avatar.png"}
                      alt="Seller Avatar"
                      className="w-32 h-32 rounded-full mx-auto border-4 border-slate-700 object-cover"
                    />
                    <h3 className="mt-4 text-xl font-bold">
                      {sellerProfile?.full_name || "Unnamed Seller"}
                    </h3>
                    <p className="text-slate-400">{sellerProfile?.email}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Registered {formatDistanceToNow(new Date(sellerProfile?.created_at || Date.now()), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{sellerProfile?.average_rating?.toFixed(1) || "0.0"}</p>
                        <p className="text-xs text-slate-400">Rating</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{sellerProfile?.review_count || 0}</p>
                        <p className="text-xs text-slate-400">Reviews</p>
                      </div>
                    </div>
                  </div>

                  {sellerProfile?.bio && (
                    <div>
                      <h4 className="font-medium mb-1">Bio</h4>
                      <p className="text-slate-300 text-sm">{sellerProfile.bio}</p>
                    </div>
                  )}

                  {sellerProfile?.portfolio_images?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-1">Portfolio ({sellerProfile.portfolio_images.length})</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {sellerProfile.portfolio_images.slice(0, 6).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Portfolio ${i + 1}`}
                            className="w-full h-20 object-cover rounded"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Evidence Review */}
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <h3 className="font-medium mb-3">Submitted Evidence ({sellerVerification.evidence_urls.length} files)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sellerVerification.evidence_urls.map((url, index) => (
                        <div key={index} className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                          {url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                            <img
                              src={url}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-64 object-contain"
                            />
                          ) : (
                            <div className="h-64 flex items-center justify-center">
                              <FileText className="h-16 w-16 text-slate-400" />
                            </div>
                          )}
                          <div className="p-2 flex justify-between items-center bg-slate-900">
                            <span className="text-xs text-slate-400 truncate max-w-[70%]">
                              File {index + 1}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(url, "_blank")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Decision */}
                  <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="font-medium mb-4">Admin Decision</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="reject-reason">Rejection Reason (required if rejecting)</Label>
                        <Textarea
                          id="reject-reason"
                          placeholder="Explain why verification is being rejected..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="min-h-[120px] mt-2"
                        />
                      </div>

                      <div className="flex flex-col justify-end gap-4">
                        <Button
                          onClick={handleApprove}
                          disabled={approveLoading || rejectLoading}
                          className="bg-green-600 hover:bg-green-700 h-12 text-lg"
                        >
                          {approveLoading ? "Approving..." : "Approve & Verify Seller"}
                        </Button>
                        <Button
                          onClick={handleReject}
                          disabled={rejectLoading || approveLoading || !rejectReason.trim()}
                          variant="destructive"
                          className="h-12 text-lg"
                        >
                          {rejectLoading ? "Rejecting..." : "Reject Verification"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}