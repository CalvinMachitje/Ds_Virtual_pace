/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/admin/VerificationsAdmin.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle, XCircle, Eye, RefreshCw } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { formatDistanceToNow } from "date-fns";

type Verification = {
  id: string;
  seller_id: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  evidence_urls?: string[] | null;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  seller?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export default function VerificationsAdmin() {
  const queryClient = useQueryClient();

  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedVer, setSelectedVer] = useState<Verification | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Fetch all verifications – default to empty array
  const { 
    data: verifications = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Verification[]>({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/verifications", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load verifications");
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (verId: string) => {
      const res = await fetch(`/api/admin/verifications/${verId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ status: "approved" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Verification approved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      setConfirmApproveOpen(false);
      setSelectedVer(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve verification");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ verId, reason }: { verId: string; reason: string }) => {
      const res = await fetch(`/api/admin/verifications/${verId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ status: "rejected", rejection_reason: reason.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rejection failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Verification rejected successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
      setRejectOpen(false);
      setRejectReason("");
      setSelectedVer(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject verification");
    },
  });

  const handleApproveClick = (ver: Verification) => {
    setSelectedVer(ver);
    setConfirmApproveOpen(true);
  };

  const handleRejectClick = (ver: Verification) => {
    setSelectedVer(ver);
    setRejectOpen(true);
    setRejectReason("");
  };

  const confirmApprove = () => {
    if (!selectedVer) return;
    approveMutation.mutate(selectedVer.id);
  };

  const confirmReject = () => {
    if (!selectedVer) return;
    if (rejectReason.trim().length < 10) {
      toast.error("Rejection reason must be at least 10 characters");
      return;
    }
    rejectMutation.mutate({ verId: selectedVer.id, reason: rejectReason });
  };

  const viewEvidence = (url: string) => {
    window.open(url, "_blank");
  };

  // Safe array handling – prevents .filter crash
  const safeVerifications = Array.isArray(verifications) ? verifications : [];
  const pendingVerifications = safeVerifications.filter(v => v.status === "pending") ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 md:mb-8">Manage Verifications</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pending Verifications ({pendingVerifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton height={60} count={5} />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-lg">
                No pending verification requests at the moment.
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
                        <TableCell className="text-white font-medium">
                          {v.seller?.full_name || "Unnamed Seller"}
                        </TableCell>
                        <TableCell className="text-slate-300 break-all">
                          {v.seller?.email || v.seller_id.substring(0, 8) + "..."}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {formatDistanceToNow(new Date(v.submitted_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {v.evidence_urls && v.evidence_urls.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {v.evidence_urls.map((url, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => viewEvidence(url)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View {idx + 1}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            "No documents"
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveClick(v)}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {approveMutation.isPending && selectedVer?.id === v.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectClick(v)}
                            disabled={rejectMutation.isPending}
                          >
                            {rejectMutation.isPending && selectedVer?.id === v.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Reject
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

        {/* Confirm Approve Dialog */}
        <Dialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Verification?</DialogTitle>
              <DialogDescription>
                This will mark the seller as verified and grant them the verified badge.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmApproveOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmApprove}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Approving...
                  </>
                ) : (
                  "Confirm Approve"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject with Reason Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Verification</DialogTitle>
              <DialogDescription>
                Provide a clear reason for rejection (minimum 10 characters).
                The seller will see this reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter rejection reason... (e.g., Missing valid ID, Blurry documents, etc.)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[120px]"
              />
              {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                <p className="text-red-400 text-sm">Reason must be at least 10 characters</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={rejectMutation.isPending || rejectReason.trim().length < 10}
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Rejecting...
                  </>
                ) : (
                  "Confirm Reject"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}