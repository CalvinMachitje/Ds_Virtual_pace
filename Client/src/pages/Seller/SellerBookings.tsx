/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/seller/SellerBookings.tsx
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MessageSquare, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Booking = {
  id: string;
  gig: {
    id: string;
    title: string;
    price: number;
  };
  buyer: {
    id: string;
    full_name: string;
  };
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  price: number;
  requirements?: string;
  created_at: string;
  updated_at: string;
};

export default function SellerBookings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: bookings = [], isLoading, error } = useQuery<Booking[]>({
    queryKey: ["seller-bookings", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, price, requirements, created_at, updated_at,
          gig:gig_id (id, title, price),
          buyer:buyer_id (id, full_name)
        `)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Normalize gig and buyer
      const normalized = (data || []).map((row: any) => {
        const gig = Array.isArray(row.gig) ? row.gig[0] ?? null : row.gig;
        const buyer = Array.isArray(row.buyer) ? row.buyer[0] ?? null : row.buyer;

        return {
          id: row.id,
          status: row.status,
          price: row.price,
          requirements: row.requirements,
          created_at: row.created_at,
          updated_at: row.updated_at,
          gig,
          buyer,
        } as Booking;
      });

      return normalized;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`seller-bookings:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `seller_id=eq.${user.id}`,
        },
        (payload) => {
          const booking = payload.new || payload.old;
          const gigTitle = (payload.new as any)?.gig?.title || "a gig";

          if (payload.eventType === "INSERT") {
            toast.info(`New booking request for "${gigTitle}"`);
          } else if (payload.eventType === "UPDATE") {
            const newStatus = payload.new.status;
            const oldStatus = payload.old.status;

            if (newStatus !== oldStatus) {
              if (newStatus === "accepted") {
                toast.success(`You accepted booking for "${gigTitle}"`);
              } else if (newStatus === "rejected") {
                toast.warning(`You rejected booking for "${gigTitle}"`);
              } else if (newStatus === "cancelled") {
                toast.info(`Booking for "${gigTitle}" was cancelled by buyer`);
              }
            }
          } else if (payload.eventType === "DELETE") {
            toast.warning(`A booking for "${gigTitle}" was deleted`);
          }

          queryClient.invalidateQueries({ queryKey: ["seller-bookings", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const updateBookingStatus = useMutation({
    mutationFn: async ({ bookingId, newStatus }: { bookingId: string; newStatus: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId)
        .eq("seller_id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Booking ${variables.newStatus === "accepted" ? "accepted" : "rejected"}`);
      queryClient.invalidateQueries({ queryKey: ["seller-bookings", user?.id] });
    },
    onError: (err) => {
      toast.error("Failed to update booking: " + err.message);
    },
  });

  const handleMessageBuyer = (bookingId: string, buyerName: string) => {
    toast.info(`Opening chat with ${buyerName}...`);
    navigate(`/chat/${bookingId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Incoming Bookings</h1>
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={180} className="rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <p className="text-xl mb-4">Failed to load bookings</p>
        <p className="text-slate-400 mb-6">{error.message}</p>
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ["seller-bookings", user?.id] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Incoming Bookings</h1>

        {bookings.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">No incoming bookings yet</p>
            <p className="mt-2">When buyers request your gigs, they'll appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <Card key={booking.id} className="bg-slate-900/70 border-slate-700">
                <CardHeader>
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <CardTitle className="text-white text-xl">
                        {booking.gig.title}
                      </CardTitle>
                      <p className="text-slate-400 mt-1">
                        from {booking.buyer.full_name}
                      </p>
                    </div>
                    <Badge
                      variant={
                        booking.status === "accepted" ? "outline" :
                        booking.status === "rejected" || booking.status === "cancelled" ? "destructive" :
                        booking.status === "completed" ? "default" :
                        "secondary"
                      }
                      className="text-base px-4 py-1"
                    >
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="h-4 w-4" />
                      Requested {new Date(booking.created_at).toLocaleDateString()}
                    </div>
                    <span className="font-medium text-emerald-400">
                      R{booking.price.toFixed(2)} / hour
                    </span>
                  </div>

                  {booking.requirements && (
                    <div className="text-sm text-slate-300 border-t border-slate-700 pt-3">
                      <strong className="block mb-1">Buyer's requirements:</strong>
                      {booking.requirements}
                    </div>
                  )}

                  {booking.status === "pending" && (
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={() => updateBookingStatus.mutate({ bookingId: booking.id, newStatus: "accepted" })}
                        disabled={updateBookingStatus.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {updateBookingStatus.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Accept
                      </Button>

                      <Button
                        onClick={() => updateBookingStatus.mutate({ bookingId: booking.id, newStatus: "rejected" })}
                        disabled={updateBookingStatus.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        {updateBookingStatus.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Reject
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleMessageBuyer(booking.id, booking.buyer.full_name)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message Buyer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}