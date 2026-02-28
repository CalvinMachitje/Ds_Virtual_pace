// src/pages/admin/UsersAdmin.tsx
import { useState, useMemo } from "react";
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
import { formatDistanceToNow } from "date-fns";

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
  evidence_url?: string | null;
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

  const [reviewSeller, setReviewSeller] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const pageSize = 10;

  // Fetch users from Flask API
  const { data: response = {}, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("No auth token");

      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }

      return res.json();
    },
    retry: 1,
  });

  // Extract users array from response
  const users: User[] = response.users || [];

  const pendingVerifications = useMemo(
    () => users.filter(u => u.role === "seller" && !u.is_verified),
    [users]
  );

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          (u.full_name?.toLowerCase().includes(term) ||
           u.email.toLowerCase().includes(term) ||
           u.id.toLowerCase().includes(term))
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal == null) return 1;
        if (bVal == null) return -1;

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

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ action, userIds }: { action: string; userIds: string[] }) => {
      const res = await fetch("/api/admin/users/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ action, userIds }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Bulk action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Bulk action completed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedUsers([]);
    },
    onError: (err: any) => toast.error(err.message || "Bulk action failed"),
  });

  const handleBulkAction = (action: "ban" | "unban" | "verify" | "unverify") => {
    if (selectedUsers.length === 0) {
      toast.warning("No users selected");
      return;
    }
    setConfirmAction({ type: action, userIds: selectedUsers });
  };

  const executeBulkAction = () => {
    if (!confirmAction) return;
    bulkUpdateMutation.mutate({ action: confirmAction.type, userIds: confirmAction.userIds });
    setConfirmAction(null);
  };

  const singleUpdateMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.message || "Update failed"),
  });

  const handleSingleAction = (userId: string, action: "ban" | "unban" | "verify" | "unverify") => {
    singleUpdateMutation.mutate({ userId, action });
  };

  const verifySeller = (userId: string) => {
    handleSingleAction(userId, "verify");
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">Error Loading Users</h2>
          <p className="text-slate-400">{(error as Error).message}</p>
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

        {/* Pending Verifications */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pending Seller Verifications ({pendingVerifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingVerifications.length === 0 ? (
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
                    {pendingVerifications.map((u) => (
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
                            disabled={approveLoading}
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

        {/* Users Table */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-lg">
                No users found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all users on page"
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
                            aria-label={`Select user ${u.full_name || u.email}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{u.full_name || "Unnamed"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
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
                        <TableCell>{new Date(u.created_at).toLocaleDateString("en-ZA")}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

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
          </CardContent>
        </Card>
      </div>

      {/* Bulk Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} {confirmAction?.userIds.length} user(s)?
              This action cannot be undone.
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
              Seller Verification Review
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
                        onClick={() => {
                          setApproveLoading(true);
                          handleSingleAction(reviewSeller.id, "verify");
                          setTimeout(() => {
                            setApproveLoading(false);
                            setReviewSeller(null);
                          }, 800);
                        }}
                        disabled={approveLoading}
                        className="flex-1"
                      >
                        {approveLoading ? "Approving..." : "Approve & Verify Seller"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setRejectLoading(true);
                          setTimeout(() => {
                            setRejectLoading(false);
                            setReviewSeller(null);
                            setRejectReason("");
                            toast.success("Seller rejected");
                          }, 800);
                        }}
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
                        {reviewSeller.evidence_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
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