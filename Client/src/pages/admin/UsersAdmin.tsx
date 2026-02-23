// src/pages/admin/UsersAdmin.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
  RotateCcw,
  AlertCircle,
  Eye,
  Users,
  X,
  Download,
  FileText,
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
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  full_name: string | null;
  email: string;
  role: "buyer" | "seller" | "admin";
  created_at: string;
  is_verified: boolean;
  is_online: boolean;
  rating: number | null;
  banned: boolean | null;
  evidence_url?: string | null; // optional – if you join from verifications
};

type SortConfig = {
  key: keyof User;
  direction: "asc" | "desc";
};

export default function UsersAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller" | "admin">("all");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    type: "ban" | "unban" | "verify" | "unverify";
    userIds: string[];
  } | null>(null);

  // Evidence review modal
  const [reviewSeller, setReviewSeller] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const pageSize = 10;

  // Fetch all users + join latest pending verification evidence if exists
  const { data: users = [], isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Get profiles
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at, is_verified, is_online, rating, banned");

      if (profileErr) throw profileErr;

      // Get latest pending verification evidence for each seller (optional join)
      const sellerIds = profiles.filter(p => p.role === "seller" && !p.is_verified).map(p => p.id);
      let evidenceMap: Record<string, string | null> = {};

      if (sellerIds.length > 0) {
        const { data: verifications } = await supabase
          .from("verifications")
          .select("seller_id, evidence_url")
          .in("seller_id", sellerIds)
          .eq("status", "pending")
          .order("submitted_at", { ascending: false });

        verifications?.forEach((v: any) => {
          if (!evidenceMap[v.seller_id]) {
            evidenceMap[v.seller_id] = v.evidence_url;
          }
        });
      }

      // Merge evidence_url into user objects
      return profiles.map((p) => ({
        ...p,
        evidence_url: p.role === "seller" && !p.is_verified ? evidenceMap[p.id] || null : null,
      }));
    },
  });

  // Pending sellers: only unverified sellers
  const pendingVerificationsData = useMemo(
    () => users.filter(u => u.role === "seller" && !u.is_verified),
    [users]
  );

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("profiles-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter & sort users (main table)
  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.id.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

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

  const buyers = useMemo(() => filteredUsers.filter(u => u.role === "buyer"), [filteredUsers]);
  const sellers = useMemo(() => filteredUsers.filter(u => u.role === "seller"), [filteredUsers]);

  // ────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────
  const handleSort = (key: keyof User) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map((u) => u.id));
    }
  };

  const handleBulkAction = (action: "ban" | "unban" | "verify" | "unverify") => {
    if (selectedUsers.length === 0) {
      toast.warning("No users selected");
      return;
    }
    setConfirmAction({ type: action, userIds: selectedUsers });
  };

  const executeBulkAction = async () => {
    if (!confirmAction) return;

    const { type, userIds } = confirmAction;
    setConfirmAction(null);

    const updateData: Partial<User> = {};

    if (type === "ban") updateData.banned = true;
    if (type === "unban") updateData.banned = false;
    if (type === "verify") updateData.is_verified = true;
    if (type === "unverify") updateData.is_verified = false;

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .in("id", userIds);

      if (error) throw error;

      toast.success(`${userIds.length} users ${type}d successfully`);
      refetch();
      setSelectedUsers([]);
    } catch (err: any) {
      toast.error(`Bulk action failed: ${err.message}`);
    }
  };

  const handleSingleAction = (userId: string, action: "ban" | "unban" | "verify" | "unverify") => {
    setConfirmAction({ type: action, userIds: [userId] });
  };

  const verifySeller = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", userId)
        .eq("role", "seller");

      if (error) throw error;

      toast.success("Seller verified successfully");
      navigate("/admin/verifications");
    } catch (err: any) {
      toast.error("Failed to verify seller: " + err.message);
    }
  };

  const approveSeller = async () => {
    if (!reviewSeller) return;

    setApproveLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", reviewSeller.id)
        .eq("role", "seller");

      if (error) throw error;

      toast.success("Seller approved and verified");
      setReviewSeller(null);
      navigate("/admin/verifications");
    } catch (err: any) {
      toast.error("Approval failed: " + err.message);
    } finally {
      setApproveLoading(false);
    }
  };

  const rejectSeller = async () => {
    if (!reviewSeller) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setRejectLoading(true);
    try {
      // Optional: you can log rejection reason somewhere if you have a column
      toast.success("Seller rejected");
      setReviewSeller(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error("Rejection failed: " + err.message);
    } finally {
      setRejectLoading(false);
    }
  };

  const viewProfile = (user: User) => {
    const profilePath =
      user.role === "buyer"
        ? `/profile/${user.id}`
        : user.role === "seller"
          ? `/seller-profile/${user.id}`
          : `/admin/users/${user.id}`;

    navigate(profilePath);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                <DropdownMenuItem onClick={() => { setRoleFilter("all"); setPage(1); }}>
                  All Roles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRoleFilter("buyer"); setPage(1); }}>
                  Buyers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRoleFilter("seller"); setPage(1); }}>
                  Sellers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRoleFilter("admin"); setPage(1); }}>
                  Admins
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Pending Verifications – only unverified sellers */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pending Seller Verifications ({pendingVerificationsData.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingVerificationsData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-lg">
                No sellers awaiting verification.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingVerificationsData.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell className="font-medium">{u.full_name || "Unnamed Seller"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString("en-ZA")}</TableCell>
                        <TableCell>
                          {u.evidence_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewSeller(u)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Evidence
                            </Button>
                          ) : (
                            <span className="text-slate-500">No evidence</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => verifySeller(u.id)}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewProfile(u)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyers Table */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Buyers ({buyers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Banned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        No buyers found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    buyers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell>{u.full_name || "Unnamed"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString("en-ZA")}</TableCell>
                        <TableCell>
                          <Badge variant={u.banned ? "destructive" : "outline"}>
                            {u.banned ? "Banned" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewProfile(u)}
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={u.banned ? "default" : "destructive"}
                            size="sm"
                            onClick={() => handleSingleAction(u.id, u.banned ? "unban" : "ban")}
                          >
                            {u.banned ? "Unban" : "Ban"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sellers Table */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sellers ({sellers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Banned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        No sellers found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sellers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell>{u.full_name || "Unnamed"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.is_verified ? "default" : "secondary"}>
                            {u.is_verified ? "Verified" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.banned ? "destructive" : "outline"}>
                            {u.banned ? "Banned" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewProfile(u)}
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={u.banned ? "default" : "destructive"}
                            size="sm"
                            onClick={() => handleSingleAction(u.id, u.banned ? "unban" : "ban")}
                          >
                            {u.banned ? "Unban" : "Ban"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between mt-6 flex-wrap gap-4">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>

            <span className="text-slate-400 text-sm">
              Page {page} of {totalPages} • {filteredUsers.length} users total
            </span>

            <Button
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Bulk Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} {confirmAction?.userIds.length} user(s)?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className={confirmAction?.type.includes("ban") || confirmAction?.type === "unverify" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Evidence Review Modal */}
      <Dialog open={!!reviewSeller} onOpenChange={() => setReviewSeller(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Seller Verification Review</span>
              <Button variant="ghost" size="icon" onClick={() => setReviewSeller(null)}>
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {reviewSeller && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">Seller Info</h3>
                    <p><strong>Name:</strong> {reviewSeller.full_name || "N/A"}</p>
                    <p><strong>Email:</strong> {reviewSeller.email || "N/A"}</p>
                    <p><strong>Registered:</strong> {new Date(reviewSeller.created_at).toLocaleDateString()}</p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-1">Actions</h3>
                    <div className="flex gap-3">
                      <Button
                        onClick={approveSeller}
                        disabled={approveLoading}
                        className="flex-1"
                      >
                        {approveLoading ? "Approving..." : "Approve & Verify Seller"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={rejectSeller}
                        disabled={rejectLoading}
                        className="flex-1"
                      >
                        {rejectLoading ? "Rejecting..." : "Reject Seller"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">Evidence Preview</h3>
                    {reviewSeller.evidence_url ? (
                      <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                        {reviewSeller.evidence_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                          <img
                            src={reviewSeller.evidence_url}
                            alt="Verification evidence"
                            className="max-h-[500px] w-full object-contain"
                          />
                        ) : (
                          <div className="p-12 text-center">
                            <FileText className="h-20 w-20 mx-auto mb-4 text-slate-400" />
                            <p className="text-slate-300 mb-4">Non-image file evidence</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-center py-12">No evidence uploaded</p>
                    )}
                  </div>

                  {reviewSeller.evidence_url && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(reviewSeller.evidence_url!, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Evidence
                    </Button>
                  )}
                </div>
              </div>

              {/* Reject Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection Reason (required if rejecting)</label>
                <Textarea
                  placeholder="Explain why verification is rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}