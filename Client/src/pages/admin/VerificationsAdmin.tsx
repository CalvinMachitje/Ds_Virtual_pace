/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/admin/VerificationsAdmin.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Download,
  FileText,
  User,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@radix-ui/react-label";

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
  seller?: {
    is_online: any;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    portfolio_images?: string[];
    average_rating: number;
    review_count: number;
  };
};

export default function VerificationsAdmin() {
  const queryClient = useQueryClient();

  const [selectedVer, setSelectedVer] = useState<Verification | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  // Fetch all verifications (focus on pending)
  const { 
    data: verifications = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Verification[]>({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("No auth token");

      const res = await fetch("/api/admin/verifications/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load verifications");
      }

      return res.json();
    },
    refetchInterval: 30000, // real-time polling every 30s
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (verId: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/admin/verifications/${verId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Seller verified successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      setSelectedVer(null);
      setApproveLoading(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve");
      setApproveLoading(false);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ verId, reason }: { verId: string; reason: string }) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/admin/verifications/${verId}/reject`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rejection_reason: reason.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rejection failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Verification rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      setSelectedVer(null);
      setRejectReason("");
      setRejectLoading(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject");
      setRejectLoading(false);
    },
  });

  const handleApprove = () => {
    if (!selectedVer?.id) return;
    setApproveLoading(true);
    approveMutation.mutate(selectedVer.id);
  };

  const handleReject = () => {
    if (!selectedVer?.id) return;
    if (rejectReason.trim().length < 10) {
      toast.error("Rejection reason must be at least 10 characters");
      return;
    }
    setRejectLoading(true);
    rejectMutation.mutate({ verId: selectedVer.id, reason: rejectReason });
  };

  const viewEvidence = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Safe handling
  const pendingVerifications = Array.isArray(verifications) 
    ? verifications.filter(v => v.status === "pending")
    : [];

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <AlertCircle className="h-16 w-16 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Error Loading Verifications</h2>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 md:mb-8 flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-yellow-500" />
          Manage Verifications
        </h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pending Seller Verifications ({pendingVerifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="text-center py-16 text-slate-400 border border-dashed border-slate-700 rounded-xl">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">No pending verification requests</p>
                <p className="mt-2">All sellers are up to date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-400">Seller</TableHead>
                      <TableHead className="text-slate-400">Email</TableHead>
                      <TableHead className="text-slate-400">Submitted</TableHead>
                      <TableHead className="text-slate-400">Evidence</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingVerifications.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-800/50 transition-colors">
                        <TableCell className="font-medium text-white">
                          {v.seller?.full_name || "Unnamed Seller"}
                        </TableCell>
                        <TableCell className="text-slate-300 break-all">
                          {v.seller?.email || v.seller_id.substring(0, 8) + "..."}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {formatDistanceToNow(new Date(v.submitted_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {v.evidence_urls?.length || 0} file(s)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedVer(v)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
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

        {/* Review Modal */}
        <Dialog open={!!selectedVer} onOpenChange={() => {
          setSelectedVer(null);
          setRejectReason("");
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-xl">
                Seller Verification Review
                <Button variant="ghost" size="icon" onClick={() => setSelectedVer(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            {selectedVer && (
              <div className="space-y-8 py-4">
                {/* Seller Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-6">
                    <div className="text-center">
                      <div className="relative inline-block">
                        <img
                          src={selectedVer.seller?.avatar_url || "/default-avatar.png"}
                          alt="Seller Avatar"
                          className="w-32 h-32 rounded-full mx-auto border-4 border-slate-700 object-cover"
                        />
                        {selectedVer.seller && (
                          <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-1 border-2 border-background">
                            {selectedVer.seller.is_online ? (
                              <div className="h-4 w-4 bg-green-500 rounded-full" />
                            ) : (
                              <div className="h-4 w-4 bg-slate-500 rounded-full" />
                            )}
                          </div>
                        )}
                      </div>
                      <h3 className="mt-4 text-xl font-bold">
                        {selectedVer.seller?.full_name || "Unnamed Seller"}
                      </h3>
                      <p className="text-slate-400 mt-1">{selectedVer.seller?.email}</p>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold">
                        {selectedVer.seller?.average_rating?.toFixed(1) || "0.0"}
                      </p>
                      <p className="text-sm text-slate-400">
                        ({selectedVer.seller?.review_count || 0} reviews)
                      </p>
                    </div>

                    {selectedVer.seller?.bio && (
                      <div>
                        <h4 className="font-medium mb-2">Bio</h4>
                        <p className="text-slate-300 text-sm">{selectedVer.seller.bio}</p>
                      </div>
                    )}

                    {selectedVer.seller?.portfolio_images?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">
                          Portfolio ({selectedVer.seller.portfolio_images.length})
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedVer.seller.portfolio_images.slice(0, 6).map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`Portfolio ${i + 1}`}
                              className="w-full h-20 object-cover rounded border border-slate-700"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Evidence & Decision */}
                  <div className="md:col-span-2 space-y-6">
                    <div>
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Submitted Evidence ({selectedVer.evidence_urls?.length || 0} files)
                      </h3>

                      {selectedVer.evidence_urls?.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedVer.evidence_urls.map((url, idx) => (
                            <div key={idx} className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                              {url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                                <img
                                  src={url}
                                  alt={`Evidence ${idx + 1}`}
                                  className="w-full h-64 object-contain"
                                />
                              ) : (
                                <div className="h-64 flex items-center justify-center bg-slate-900">
                                  <FileText className="h-16 w-16 text-slate-400" />
                                </div>
                              )}
                              <div className="p-3 flex justify-between items-center bg-slate-900 border-t border-slate-700">
                                <span className="text-sm text-slate-400 truncate max-w-[70%]">
                                  File {idx + 1}
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
                      ) : (
                        <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-700">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                          <p className="text-slate-400">No evidence documents uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Decision Section */}
                    <div className="bg-slate-800/70 p-6 rounded-lg border border-slate-700">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        Admin Decision
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="reject-reason" className="mb-2 block">
                            Rejection Reason (required if rejecting)
                          </Label>
                          <Textarea
                            id="reject-reason"
                            placeholder="Explain clearly why verification is rejected (min 10 characters)..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[140px] resize-none"
                          />
                          {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                            <p className="text-red-400 text-sm mt-2">
                              Reason must be at least 10 characters
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col justify-end gap-4">
                          <Button
                            onClick={handleApprove}
                            disabled={approveLoading || rejectLoading}
                            className="h-12 text-lg bg-green-600 hover:bg-green-700"
                          >
                            {approveLoading ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Approve & Verify Seller
                              </>
                            )}
                          </Button>

                          <Button
                            onClick={handleReject}
                            disabled={rejectLoading || approveLoading || rejectReason.trim().length < 10}
                            variant="destructive"
                            className="h-12 text-lg"
                          >
                            {rejectLoading ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                Rejecting...
                              </>
                            ) : (
                              <>
                                <XCircle className="h-5 w-5 mr-2" />
                                Reject Verification
                              </>
                            )}
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
    </div>
  );
}