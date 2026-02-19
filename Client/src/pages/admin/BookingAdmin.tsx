// src/pages/admin/BookingsAdmin.tsx (Managing bookings)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
  const { data: bookings, isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*");

      if (error) {
        toast.error("Failed to load bookings: " + error.message);
        throw error;
      }

      return data || [];
    },
  });

  const handleUpdateStatus = async (bookingId: string, newStatus: Booking["status"]) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", bookingId);

    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success("Booking status updated");
      refetch();
    }
  };

  if (isLoading) {
    return <Skeleton height={500} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
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
                          onClick={() => handleUpdateStatus(b.id, "completed")}
                          disabled={b.status === "completed"}
                        >
                          Complete
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUpdateStatus(b.id, "cancelled")}
                          disabled={b.status === "cancelled"}
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