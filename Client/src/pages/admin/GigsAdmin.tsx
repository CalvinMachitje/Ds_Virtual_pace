// src/pages/admin/GigsAdmin.tsx (Managing gigs)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";

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

export default function GigsAdmin() {
  const { data: gigs, isLoading, refetch } = useQuery<Gig[]>({
    queryKey: ["admin-gigs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gigs")
        .select("id, title, description, price, category, seller_id, created_at, status");

      if (error) {
        toast.error("Failed to load gigs: " + error.message);
        throw error;
      }

      return data || [];
    },
  });

  const handleApproveGig = async (gigId: string) => {
    const { error } = await supabase
      .from("gigs")
      .update({ status: "active" })
      .eq("id", gigId);

    if (error) {
      toast.error("Failed to approve gig: " + error.message);
    } else {
      toast.success("Gig approved");
      refetch();
    }
  };

  const handleRejectGig = async (gigId: string) => {
    const { error } = await supabase
      .from("gigs")
      .update({ status: "rejected" })
      .eq("id", gigId);

    if (error) {
      toast.error("Failed to reject gig: " + error.message);
    } else {
      toast.success("Gig rejected");
      refetch();
    }
  };

  if (isLoading) {
    return <Skeleton height={500} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Manage Gigs</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">All Gigs</CardTitle>
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
                          onClick={() => handleApproveGig(g.id)}
                          disabled={g.status === "active"}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRejectGig(g.id)}
                          disabled={g.status === "rejected"}
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