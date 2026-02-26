// src/pages/admin/GigsAdmin.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Eye, UserPlus, XCircle, Loader2, Send, AlertCircle, Users, Search, X, Star } from "lucide-react";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_id: string;
  created_at: string;
  status: "active" | "pending" | "rejected";
};

type JobRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget?: number;
  preferred_start_time?: string;
  estimated_due_time?: string;
  status: string;
  created_at: string;
  buyer_id: {
    full_name: string;
    email: string;
    phone?: string;
  };
};

type Seller = {
  gig_count?: number;
  sample_gigs?: string[];
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  rating?: number;
  is_available: boolean;
  employee_category: string;
};

export default function GigsAdmin() {
  const queryClient = useQueryClient();

  const [selectedRequest, setSelectedRequest] = useState<JobRequest | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);

  // Bulk assign state
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [assignNotes, setAssignNotes] = useState("");

  // Search & filter inside modal
  const [sellerSearch, setSellerSearch] = useState("");
  const [sellerFilter, setSellerFilter] = useState<"all" | "available" | "high-rated">("all");
  const [sortOption, setSortOption] = useState<"rating-desc" | "name-asc" | "available-first">("rating-desc");

  // Fetch all gigs
  const { data: gigs, isLoading: gigsLoading } = useQuery<Gig[]>({
    queryKey: ["admin-gigs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gigs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load gigs");
      return res.json();
    },
  });

  // Fetch pending job requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery<JobRequest[]>({
    queryKey: ["admin-job-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/job-requests?status=pending", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
  });

  // Fetch available sellers
  const { 
    data: availableSellersRaw = [], 
    isLoading: availableSellersLoading, 
    error: availableSellersError,
    refetch: refetchAvailableSellers 
  } = useQuery<Seller[]>({
    queryKey: ["available-sellers", selectedRequest?.category, sortOption],
    queryFn: async () => {
      if (!selectedRequest?.category) return [];
      let url = `/api/admin/available-sellers?category=${encodeURIComponent(selectedRequest.category)}`;
      if (sortOption) url += `&sort=${sortOption}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load available sellers");
      return res.json();
    },
    enabled: assignModalOpen && !!selectedRequest?.category,
  });

  // Filter & search sellers client-side
  const availableSellers = availableSellersRaw.filter(seller => {
    const matchesSearch = seller.full_name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
                         (seller.bio && seller.bio.toLowerCase().includes(sellerSearch.toLowerCase()));
    if (!matchesSearch) return false;

    if (sellerFilter === "available" && !seller.is_available) return false;
    if (sellerFilter === "high-rated" && (!seller.rating || seller.rating < 4)) return false;
    return true;
  });

  // Mutations
  const updateGigStatus = useMutation({
    mutationFn: async ({ gigId, newStatus }: { gigId: string; newStatus: "active" | "rejected" }) => {
      const res = await fetch(`/api/admin/gigs/${gigId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update gig");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Gig status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-gigs"] });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/admin/job-requests/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: JSON.stringify({ status: "rejected", reason: "Admin rejected" }),
      });
      if (!res.ok) throw new Error("Failed to reject request");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Request rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-job-requests"] });
      setViewModalOpen(false);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ sellerIds, notes }: { sellerIds: string[]; notes?: string }) => {
      const res = await fetch(`/api/admin/job-requests/${selectedRequest?.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: JSON.stringify({ seller_ids: sellerIds, notes: notes?.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign sellers");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Assigned ${selectedSellerIds.length} seller${selectedSellerIds.length !== 1 ? "s" : ""} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-job-requests"] });
      setAssignModalOpen(false);
      setConfirmAssignOpen(false);
      setSelectedSellerIds([]);
      setAssignNotes("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to assign seller(s)"),
  });

  // Handlers
  const openViewModal = (req: JobRequest) => {
    setSelectedRequest(req);
    setViewModalOpen(true);
  };

  const openAssignModal = (req: JobRequest) => {
    setSelectedRequest(req);
    setSelectedSellerIds([]);
    setAssignNotes("");
    setSellerSearch("");
    setSellerFilter("all");
    setAssignModalOpen(true);
  };

  const toggleSeller = (sellerId: string) => {
    setSelectedSellerIds(prev =>
      prev.includes(sellerId) ? prev.filter(id => id !== sellerId) : [...prev, sellerId]
    );
  };

  const clearSelection = () => setSelectedSellerIds([]);

  const openConfirmAssign = () => {
    if (selectedSellerIds.length === 0) {
      toast.error("Select at least one seller");
      return;
    }
    setConfirmAssignOpen(true);
  };

  const confirmAndAssign = () => {
    assignMutation.mutate({ sellerIds: selectedSellerIds, notes: assignNotes });
  };

  if (gigsLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton height={300} className="mb-12" />
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton height={500} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

        {/* Manage Requests Section */}
        <Card className="bg-slate-900/70 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Send className="h-5 w-5" />
              Manage Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests?.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700">
                <Send className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No pending requests at the moment.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-400">Buyer</TableHead>
                    <TableHead className="text-slate-400">Category</TableHead>
                    <TableHead className="text-slate-400">Title</TableHead>
                    <TableHead className="text-slate-400">Budget</TableHead>
                    <TableHead className="text-slate-400">Start Date</TableHead>
                    <TableHead className="text-slate-400">Due Date</TableHead>
                    <TableHead className="text-slate-400">Created</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="text-white">{req.buyer_id?.full_name || "Unknown"}</TableCell>
                      <TableCell className="text-slate-300">{req.category.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-slate-300">{req.title}</TableCell>
                      <TableCell className="text-slate-300">
                        {req.budget ? `R${req.budget.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {req.preferred_start_time
                          ? format(parseISO(req.preferred_start_time), "dd MMM yyyy")
                          : "Flexible"}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {req.estimated_due_time
                          ? format(parseISO(req.estimated_due_time), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {format(parseISO(req.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openViewModal(req)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-600 text-blue-400 hover:bg-blue-950/30"
                            onClick={() => openAssignModal(req)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" /> Assign
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm("Reject this request?")) {
                                rejectRequest.mutate(req.id);
                              }
                            }}
                            disabled={rejectRequest.isPending}
                          >
                            {rejectRequest.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-1" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Manage Gigs Section */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Manage Gigs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">Title</TableHead>
                  <TableHead className="text-slate-400">Seller ID</TableHead>
                  <TableHead className="text-slate-400">Category</TableHead>
                  <TableHead className="text-slate-400">Price</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gigs?.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="text-white">{g.title}</TableCell>
                    <TableCell className="text-slate-300">{g.seller_id}</TableCell>
                    <TableCell className="text-slate-300">{g.category}</TableCell>
                    <TableCell className="text-slate-300">R{g.price}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(g.created_at).toLocaleDateString("en-ZA")}
                    </TableCell>
                    <TableCell className="text-slate-300">{g.status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateGigStatus.mutate({ gigId: g.id, newStatus: "active" })}
                          disabled={g.status === "active" || updateGigStatus.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => updateGigStatus.mutate({ gigId: g.id, newStatus: "rejected" })}
                          disabled={g.status === "rejected" || updateGigStatus.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* View Request Modal */}
        <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Request Details: {selectedRequest?.title}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Category: {selectedRequest?.category.replace(/_/g, " ")}
              </DialogDescription>
            </DialogHeader>
            {/* ... rest of view modal content remains the same ... */}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                Close
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => openAssignModal(selectedRequest!)}
              >
                Assign Seller
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Reject this request?")) {
                    rejectRequest.mutate(selectedRequest!.id);
                  }
                }}
                disabled={rejectRequest.isPending}
              >
                {rejectRequest.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Seller Modal */}
        <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Assign Seller(s) to: {selectedRequest?.title}
              </DialogTitle>
              <DialogDescription className="text-slate-400 flex items-center justify-between">
                <span>Category: {selectedRequest?.category.replace(/_/g, " ")}</span>
                <Badge variant="outline">{selectedSellerIds.length} selected</Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-6">
              {/* Search, Filter, Sort */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or bio..."
                    value={sellerSearch}
                    onChange={(e) => setSellerSearch(e.target.value)}
                    className="pl-9 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <Select value={sellerFilter} onValueChange={(v) => setSellerFilter(v as any)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="available">Available Only</SelectItem>
                    <SelectItem value="high-rated">High Rated (≥4.0)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOption} onValueChange={(v) => setSortOption(v as any)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="rating-desc">Highest Rating</SelectItem>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="available-first">Available First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sellers Table */}
              {availableSellersLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-400" />
                  <p className="text-slate-400 mt-4">Loading sellers...</p>
                </div>
              ) : availableSellersError ? (
                <div className="text-center py-12 text-red-400">
                  <AlertCircle className="h-10 w-10 mx-auto mb-4" />
                  <p>Failed to load sellers</p>
                  <Button variant="outline" className="mt-4" onClick={() => refetchAvailableSellers()}>
                    Retry
                  </Button>
                </div>
              ) : availableSellers.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700">
                  <Users className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No matching sellers found.</p>
                  <Button variant="ghost" className="mt-2" onClick={() => {
                    setSellerSearch("");
                    setSellerFilter("all");
                  }}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-400">
                      {availableSellers.length} seller{availableSellers.length !== 1 ? "s" : ""} found
                    </p>
                    {selectedSellerIds.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        <X className="h-4 w-4 mr-1" /> Clear selection
                      </Button>
                    )}
                  </div>

                  <div className="rounded-md border border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-800/50">
                          <TableHead className="w-10 text-center"></TableHead>
                          <TableHead className="text-slate-300">Seller</TableHead>
                          <TableHead className="text-slate-300">Rating</TableHead>
                          <TableHead className="text-slate-300">Status</TableHead>
                          <TableHead className="text-slate-300">Preview</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableSellers.map((seller) => (
                          <TableRow key={seller.id} className="hover:bg-slate-800/50">
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedSellerIds.includes(seller.id)}
                                onCheckedChange={() => toggleSeller(seller.id)}
                                disabled={!seller.is_available}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 ring-1 ring-slate-600">
                                  <AvatarImage src={seller.avatar_url} alt={seller.full_name} />
                                  <AvatarFallback>{seller.full_name?.[0] || "?"}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-white">{seller.full_name || "Unnamed"}</p>
                                  <p className="text-xs text-slate-500">
                                    {seller.gig_count || 0} gig{seller.gig_count !== 1 ? "s" : ""} in this category
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {seller.rating ? (
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                  {seller.rating.toFixed(1)}
                                </div>
                              ) : "New"}
                            </TableCell>
                            <TableCell>
                              {seller.is_available ? (
                                <Badge className="bg-green-600/30 text-green-400 border-green-500/50">Available</Badge>
                              ) : (
                                <Badge variant="secondary">Unavailable</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm max-w-xs truncate">
                              {seller.bio || seller.sample_gigs?.join(" • ") || "No bio/gigs listed"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300">Notes / Reason (optional)</Label>
                  <span className="text-xs text-slate-500">
                    {assignNotes.length}/500
                  </span>
                </div>
                <Textarea
                  placeholder="Optional message or reason for assigning these sellers (visible to them)"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value.slice(0, 500))}
                  className="bg-slate-800 border-slate-700 text-white min-h-[90px] resize-none"
                  maxLength={500}
                />
              </div>

              <div className="flex flex-col gap-3 sm:min-w-[180px]">
                <Button
                  variant="outline"
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={assignMutation.isPending || selectedSellerIds.length === 0}
                  onClick={openConfirmAssign}
                >
                  {assignMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign ({selectedSellerIds.length})
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Custom Confirmation Dialog */}
        <Dialog open={confirmAssignOpen} onOpenChange={setConfirmAssignOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Confirm Assignment
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                You are about to assign <strong>{selectedSellerIds.length}</strong> seller
                {selectedSellerIds.length !== 1 ? "s" : ""} to this request.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h4 className="text-slate-300 font-medium mb-2">Request</h4>
                <p className="text-white">{selectedRequest?.title}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedRequest?.category.replace(/_/g, " ")}
                </p>
              </div>

              {assignNotes.trim() && (
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <h4 className="text-slate-300 font-medium mb-2">Notes / Reason</h4>
                  <p className="text-slate-200 whitespace-pre-wrap text-sm">{assignNotes}</p>
                </div>
              )}

              <p className="text-sm text-slate-400">
                Sellers will be notified immediately. This action cannot be undone.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAssignOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={confirmAndAssign}
                disabled={assignMutation.isPending}
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  "Confirm Assign"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}