// src/pages/admin/GigsAdmin.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  const { data: gigs, isLoading } = useQuery<Gig[]>({
    queryKey: ["admin-gigs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gigs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error("Failed to load gigs: " + (err.error || "Unknown error"));
        throw new Error(err.error || "Failed");
      }

      return res.json();
    },
  });

  const updateGigStatus = useMutation({
    mutationFn: async ({ gigId, newStatus }: { gigId: string; newStatus: "active" | "rejected" }) => {
      const res = await fetch(`/api/admin/gigs/${gigId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update gig status");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Gig status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-gigs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update gig status");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton height={500} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
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
      </div>
    </div>
  );
}