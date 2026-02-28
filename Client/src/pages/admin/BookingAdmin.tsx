// src/pages/admin/BookingsAdmin.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

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
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { 
    data: apiResponse, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ["admin-bookings", statusFilter],
    queryFn: async () => {
      let url = "/api/admin/bookings";
      if (statusFilter !== "all") {
        url += `?status=${statusFilter}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMessage = errData.error || "Failed to load bookings";
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await res.json();

      // Safeguard: ensure we always get an object with bookings array
      return {
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
        total: typeof data.total === "number" ? data.total : 0,
      };
    },
    staleTime: 1000 * 60, // 1 minute
  });

  // Safely extract bookings array - fallback to empty array
  const bookings = apiResponse?.bookings ?? [];
  const totalBookings = apiResponse?.total ?? 0;

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

      if (res.status === 404) {
        toast.warning("Booking not found — it may have been deleted.");
        return; // don't throw
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Booking status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update booking status");
    },
  });

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Failed to load bookings</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            {(error as Error)?.message || "An unexpected error occurred while fetching bookings."}
          </p>
          <Button 
            onClick={() => refetch()} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with filter */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-white">Manage Bookings</h1>

          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refetch()}
              className="border-slate-600 hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">
              {statusFilter === "all" 
                ? "All Bookings" 
                : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Bookings`}
              <span className="ml-3 text-slate-400 text-sm font-normal">
                ({totalBookings})
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent>
            {bookings.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/30 rounded-lg border border-slate-700">
                <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-300 mb-2">
                  No bookings found
                </h3>
                <p className="text-slate-400">
                  {statusFilter !== "all" 
                    ? `No bookings with status "${statusFilter}"` 
                    : "There are no bookings in the system yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-400">ID</TableHead>
                      <TableHead className="text-slate-400">Buyer</TableHead>
                      <TableHead className="text-slate-400">Seller</TableHead>
                      <TableHead className="text-slate-400">Gig</TableHead>
                      <TableHead className="text-slate-400">Price</TableHead>
                      <TableHead className="text-slate-400">Start Time</TableHead>
                      <TableHead className="text-slate-400">End Time</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Created</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-slate-800/50">
                        <TableCell className="font-mono text-sm text-slate-400">
                          {booking.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-white">{booking.buyer_id}</TableCell>
                        <TableCell className="text-slate-300">{booking.seller_id}</TableCell>
                        <TableCell className="text-slate-300">{booking.gig_id}</TableCell>
                        <TableCell className="text-emerald-400 font-medium">
                          R{booking.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {booking.start_time 
                            ? format(parseISO(booking.start_time), "dd MMM yyyy • HH:mm") 
                            : "—"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {booking.end_time 
                            ? format(parseISO(booking.end_time), "dd MMM yyyy • HH:mm") 
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              booking.status === "completed" ? "border-green-600 text-green-400 bg-green-950/30" :
                              booking.status === "active" ? "border-blue-600 text-blue-400 bg-blue-950/30" :
                              booking.status === "pending" ? "border-yellow-600 text-yellow-400 bg-yellow-950/30" :
                              "border-red-600 text-red-400 bg-red-950/30"
                            }
                          >
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {format(parseISO(booking.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {booking.status !== "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-green-600 text-green-400 hover:bg-green-950/30"
                                onClick={() => updateStatusMutation.mutate({ 
                                  bookingId: booking.id, 
                                  newStatus: "completed" 
                                })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Complete
                              </Button>
                            )}

                            {booking.status !== "cancelled" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ 
                                  bookingId: booking.id, 
                                  newStatus: "cancelled" 
                                })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
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