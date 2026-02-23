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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { formatDistanceToNow } from "date-fns";

type Verification = {
  id: string;
  seller_id: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  evidence_urls?: string[] | null; // updated to array
  full_name?: string | null;
  email?: string | null;
};

export default function VerificationsAdmin() {
  const queryClient = useQueryClient();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedVer, setSelectedVer] = useState<Verification | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: verifications = [], isLoading, error, refetch } = useQuery<Verification[]>({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/verifications", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load verifications");
      }

      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ verId, sellerId }: { verId: string; sellerId: string }) => {
      const res = await fetch(`/api/admin/verifications/${verId}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ seller_id: sellerId }),
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
      setConfirmOpen(false);
      setSelectedVer(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve verification");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ verId, reason }: { verId: string; reason: string }) => {
      const res = await fetch(`/api/admin/verifications/${verId}/reject`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ rejection_reason: reason.trim() || undefined }),
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
    setConfirmOpen(true);
  };

  const handleRejectClick = (ver: Verification) => {
    setSelectedVer(ver);
    setRejectOpen(true);
    setRejectReason("");
  };

  const confirmApprove = () => {
    if (!selectedVer) return;
    approveMutation.mutate({ verId: selectedVer.id, sellerId: selectedVer.seller_id });
  };

  const confirmReject = () => {
    if (!selectedVer) return;
    if (rejectReason.trim().length < 10) {
      toast.error("Please provide a rejection reason (min 10 characters)");
      return;
    }
    rejectMutation.mutate({ verId: selectedVer.id, reason: rejectReason });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Manage Verifications</h1>
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Pending Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton height={400} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-red-400 p-6 md:ml-64">
        <AlertCircle className="h-16 w-16 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Failed to load verifications</h2>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Manage Verifications</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Pending Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            {verifications.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-lg">
                No pending verifications at the moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-400">Seller</TableHead>
                      <TableHead className="text-slate-400">Email</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Submitted</TableHead>
                      <TableHead className="text-slate-400">Evidence</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verifications.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-800/50">
                        <TableCell className="text-white font-medium">
                          {v.full_name || "Unnamed Seller"}
                        </TableCell>
                        <TableCell className="text-slate-300 break-all">
                          {v.email || v.seller_id.substring(0, 8) + "..."}
                        </TableCell>
                        <TableCell className="text-slate-300 capitalize">{v.type}</TableCell>
                        <TableCell className="text-slate-300">
                          {formatDistanceToNow(new Date(v.submitted_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {v.evidence_urls && v.evidence_urls.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {v.evidence_urls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline text-sm"
                                >
                                  Evidence {idx + 1}
                                </a>
                              ))}
                            </div>
                          ) : (
                            "No evidence uploaded"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
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
                          </div>
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
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Verification?</DialogTitle>
              <DialogDescription>
                This will mark the seller as verified and approve their application.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
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
                Provide a reason for rejection (minimum 10 characters).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[100px]"
              />
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