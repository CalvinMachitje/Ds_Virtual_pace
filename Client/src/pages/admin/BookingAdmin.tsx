// src/pages/admin/BookingsAdmin.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";

type Booking = {
  id: string;
  buyer_id: string;
  seller_id: string;
  gig_id: string;
  price: number;
  start_time: string;
  end_time: string;
  status: "pending" | "active" | "completed" | "cancelled";
  created_at: string;
};

export default function BookingsAdmin() {
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bookings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error("Failed to load bookings: " + (err.error || "Unknown error"));
        throw new Error(err.error || "Failed");
      }

      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, newStatus }: { bookingId: string; newStatus: Booking["status"] }) => {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Booking status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
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
        <h1 className="text-3xl font-bold text-white mb-8">Manage Bookings</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">All Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">Buyer ID</TableHead>
                  <TableHead className="text-slate-400">Seller ID</TableHead>
                  <TableHead className="text-slate-400">Gig ID</TableHead>
                  <TableHead className="text-slate-400">Price</TableHead>
                  <TableHead className="text-slate-400">Start Time</TableHead>
                  <TableHead className="text-slate-400">End Time</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-white">{b.buyer_id}</TableCell>
                    <TableCell className="text-slate-300">{b.seller_id}</TableCell>
                    <TableCell className="text-slate-300">{b.gig_id}</TableCell>
                    <TableCell className="text-slate-300">R{b.price}</TableCell>
                    <TableCell className="text-slate-300">{new Date(b.start_time).toLocaleString()}</TableCell>
                    <TableCell className="text-slate-300">{new Date(b.end_time).toLocaleString()}</TableCell>
                    <TableCell className="text-slate-300">{b.status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ bookingId: b.id, newStatus: "completed" })}
                          disabled={b.status === "completed" || updateStatusMutation.isPending}
                        >
                          Complete
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ bookingId: b.id, newStatus: "cancelled" })}
                          disabled={b.status === "cancelled" || updateStatusMutation.isPending}
                        >
                          Cancel
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