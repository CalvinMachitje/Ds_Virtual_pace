// src/pages/admin/UsersAdmin.tsx
import { useState, useMemo } from "react";
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

  const pageSize = 10;

  // Fetch all users
  const { data: users = [], isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at, is_verified, is_online, rating, banned");

      if (error) {
        toast.error("Failed to load users: " + error.message);
        throw error;
      }

      return data || [];
    },
  });

  // Filter & sort users
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.id.toLowerCase().includes(term)
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Sort
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(`Bulk action failed: ${err.message}`);
    }
  };

  const handleSingleAction = (userId: string, action: "ban" | "unban" | "verify" | "unverify") => {
    setConfirmAction({ type: action, userIds: [userId] });
  };

  const viewProfile = (user: User) => {
    const profilePath =
      user.role === "buyer"
        ? `/profile/${user.id}`
        : user.role === "seller"
          ? `/seller-profile/${user.id}`
          : `/admin/users/${user.id}`; // optional future admin detail page

    navigate(profilePath);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white md:ml-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const pendingVerifications = filteredUsers.filter(u => u.role === "seller" && !u.is_verified);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
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

        {/* Pending Verifications Section */}
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
                No sellers awaiting verification at this time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingVerifications.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell className="font-medium">{u.full_name || "Unnamed Seller"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString("en-ZA")}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSingleAction(u.id, "verify")}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Approve Verification
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

        {/* Main Users Table */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-white">
              All Users ({filteredUsers.length})
            </CardTitle>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-3">
                <Button variant="destructive" size="sm" onClick={() => handleBulkAction("ban")}>
                  <Ban className="h-4 w-4 mr-1" />
                  Ban Selected ({selectedUsers.length})
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction("unban")}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Unban Selected ({selectedUsers.length})
                </Button>
                <Button variant="default" size="sm" onClick={() => handleBulkAction("verify")}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Verify Selected ({selectedUsers.length})
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all users on page"
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("full_name")}
                    >
                      Name
                      {sortConfig?.key === "full_name" && (
                        sortConfig.direction === "asc" ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                      )}
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("role")}
                    >
                      Role
                      {sortConfig?.key === "role" && (
                        sortConfig.direction === "asc" ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("created_at")}
                    >
                      Registered
                      {sortConfig?.key === "created_at" && (
                        sortConfig.direction === "asc" ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                      )}
                    </TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Online</TableHead>
                    <TableHead>Banned</TableHead>
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => handleSort("rating")}
                    >
                      Rating
                      {sortConfig?.key === "rating" && (
                        sortConfig.direction === "asc" ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                      )}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                        No users found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(u.id)}
                            onCheckedChange={() => toggleSelectUser(u.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{u.full_name || "Unnamed"}</TableCell>
                        <TableCell className="text-slate-300">{u.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              u.role === "admin" ? "default" :
                              u.role === "seller" ? "secondary" :
                              "outline"
                            }
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(u.created_at).toLocaleDateString("en-ZA")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.is_verified ? "default" : "destructive"}>
                            {u.is_verified ? "Verified" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.is_online ? "default" : "secondary"}>
                            {u.is_online ? "Online" : "Offline"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.banned ? "destructive" : "outline"}>
                            {u.banned ? "Banned" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>{u.rating?.toFixed(1) || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
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

                            <Button
                              variant={u.is_verified ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleSingleAction(u.id, u.is_verified ? "unverify" : "verify")}
                            >
                              {u.is_verified ? "Unverify" : "Verify"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

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

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} {confirmAction?.userIds.length} selected user(s)?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className={confirmAction?.type.includes("ban") || confirmAction?.type === "unverify" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              Confirm {confirmAction?.type}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}