// src/pages/admin/VerificationsAdmin.tsx (Managing verifications)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";

type Verification = {
  id: string;
  seller_id: string;
  type: "identity" | "background" | "skills";
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  evidence_url?: string;
};

export default function VerificationsAdmin() {
  const { data: verifications, isLoading, refetch } = useQuery<Verification[]>({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verifications") // assume you have a 'verifications' table
        .select("*");

      if (error) {
        toast.error("Failed to load verifications: " + error.message);
        throw error;
      }

      return data || [];
    },
  });

  const handleApprove = async (verId: string) => {
    const { error } = await supabase
      .from("verifications")
      .update({ status: "approved" })
      .eq("id", verId);

    if (error) {
      toast.error("Failed to approve: " + error.message);
    } else {
      toast.success("Verification approved");
      refetch();
    }
  };

  const handleReject = async (verId: string) => {
    const { error } = await supabase
      .from("verifications")
      .update({ status: "rejected" })
      .eq("id", verId);

    if (error) {
      toast.error("Failed to reject: " + error.message);
    } else {
      toast.success("Verification rejected");
      refetch();
    }
  };

  if (isLoading) {
    return <Skeleton height={500} />;
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">Seller ID</TableHead>
                  <TableHead className="text-slate-400">Type</TableHead>
                  <TableHead className="text-slate-400">Submitted</TableHead>
                  <TableHead className="text-slate-400">Evidence</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications?.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-white">{v.seller_id}</TableCell>
                    <TableCell className="text-slate-300">{v.type}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(v.submitted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {v.evidence_url ? (
                        <a href={v.evidence_url} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      ) : (
                        "No evidence"
                      )}
                    </TableCell>
                    <TableCell className="text-slate-300">{v.status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(v.id)}
                          disabled={v.status !== "pending"}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(v.id)}
                          disabled={v.status !== "pending"}
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
      </div>
    </div>
  );
}