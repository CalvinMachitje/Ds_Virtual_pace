// src/pages/admin/VerificationsAdmin.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";

type Verification = {
  id: string;
  seller_id: string;
  type: "identity" | "background" | "skills" | string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  evidence_url?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export default function VerificationsAdmin() {
  const navigate = useNavigate();

  const { data: verifications = [], isLoading, refetch } = useQuery<Verification[]>({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verifications")
        .select(`
          id,
          seller_id,
          type,
          status,
          submitted_at,
          evidence_url,
          profiles!seller_id (full_name, email)
        `)
        .eq("status", "pending")
        .order("submitted_at", { ascending: false });

      if (error) {
        toast.error("Failed to load verifications: " + error.message);
        throw error;
      }

      return (data || []).map((v: any) => ({
        ...v,
        full_name: v.profiles?.full_name || null,
        email: v.profiles?.email || null,
      }));
    },
  });

  const handleApprove = async (verId: string, sellerId: string) => {
    try {
      // 1. Approve verification record
      const { error: verError } = await supabase
        .from("verifications")
        .update({ status: "approved" })
        .eq("id", verId);

      if (verError) throw verError;

      // 2. Mark seller as verified in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", sellerId);

      if (profileError) throw profileError;

      toast.success("Verification approved");
      refetch();
    } catch (err: any) {
      toast.error("Failed to approve verification: " + err.message);
    }
  };

  const handleReject = async (verId: string) => {
    try {
      const { error } = await supabase
        .from("verifications")
        .update({ status: "rejected" })
        .eq("id", verId);

      if (error) throw error;

      toast.success("Verification rejected");
      refetch();
    } catch (err: any) {
      toast.error("Failed to reject verification: " + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton height={500} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
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
                        <TableCell className="text-slate-300">{v.email || v.seller_id}</TableCell>
                        <TableCell className="text-slate-300">{v.type}</TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(v.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {v.evidence_url ? (
                            <a
                              href={v.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              View Evidence
                            </a>
                          ) : (
                            "No evidence"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(v.id, v.seller_id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReject(v.id)}
                            >
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
      </div>
    </div>
  );
}