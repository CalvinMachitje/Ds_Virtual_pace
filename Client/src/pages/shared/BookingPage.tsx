// src/pages/shared/BookingPage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  DollarSign,
  CreditCard,
  ShieldCheck,
  Star,
  MessageSquare,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Booking = {
  id: string;
  buyer_id: string;
  seller_id: string;
  service: string;
  start_time: string;
  duration_hours: number;
  price_per_hour: number;
  total_price: number;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  payment_method?: string;
};

type EnrichedBooking = Booking & {
  avatar_url: string | undefined;
  other_party_name: string;
  isBuyer: boolean;
};

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: booking, isLoading, error } = useQuery<EnrichedBooking>({
    queryKey: ["booking", id, user?.id],
    queryFn: async () => {
      if (!id || !user?.id) throw new Error("Invalid booking or user");

      const res = await fetch(`/api/bookings/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Booking not found");
      }

      const bookingData = await res.json();

      // Determine other party
      const isBuyer = bookingData.buyer_id === user.id;
      const otherParty = isBuyer
        ? bookingData.seller
        : bookingData.buyer;

      return {
        ...bookingData,
        avatar_url: otherParty?.avatar_url,
        other_party_name: otherParty?.full_name || (isBuyer ? "Service Provider" : "Client"),
        isBuyer,
      };
    },
    enabled: !!id && !!user?.id,
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400 p-6">
        <div className="text-center">
          <p className="text-xl mb-4">Failed to load booking</p>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => navigate("/bookings")}>Back to Bookings</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <Skeleton height={120} />
          <Skeleton height={300} />
          <Skeleton height={180} />
        </div>
      </div>
    );
  }

  const otherPartyName = booking.other_party_name;
  const isBuyer = booking.isBuyer;
  const statusColor = {
    pending: "bg-amber-600",
    accepted: "bg-blue-600",
    in_progress: "bg-purple-600",
    completed: "bg-green-600",
    cancelled: "bg-red-600",
  }[booking.status] || "bg-slate-600";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6 md:ml-64">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {isBuyer ? "Your Booking" : "Client Booking"}
          </h1>
          <Badge className={cn("px-4 py-1.5 text-sm", statusColor)}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Badge>
        </div>

        {/* Other Party Card */}
        <Card className="bg-slate-900/80 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-slate-700">
                <AvatarImage src={booking.avatar_url} alt={otherPartyName} />
                <AvatarFallback>{otherPartyName?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">{otherPartyName}</h2>
                <p className="text-slate-400">
                  {isBuyer ? "Service Provider" : "Client"}
                </p>
              </div>
              <Button variant="outline" size="icon" className="border-slate-600">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Service & Time */}
        <Card className="bg-slate-900/70 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-white">Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Date & Time</p>
                    <p className="text-white font-medium">
                      {new Date(booking.start_time).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-950/50 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Duration</p>
                    <p className="text-white font-medium">{booking.duration_hours} hours</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-950/50 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Rate</p>
                    <p className="text-white font-medium">
                      R{booking.price_per_hour.toFixed(2)} / hr × {booking.duration_hours} hrs
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      R{booking.total_price.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role-specific Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {booking.isBuyer ? (
            <>
              <Button
                variant="outline"
                className="border-slate-600 hover:bg-slate-800 h-14 text-lg"
                disabled={booking.status !== "pending"}
                onClick={() => toast.info("Cancellation feature coming soon")}
              >
                Cancel Booking
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 h-14 text-lg"
                disabled={booking.status === "completed" || booking.status === "cancelled"}
                onClick={() => navigate(`/chat/${booking.seller_id}`)}
              >
                Message Provider
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="border-slate-600 hover:bg-slate-800 h-14 text-lg"
                disabled={booking.status !== "pending"}
                onClick={() => toast.info("Decline feature coming soon")}
              >
                Decline
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 h-14 text-lg"
                disabled={booking.status !== "pending"}
                onClick={() => toast.info("Accept feature coming soon")}
              >
                Accept Booking
              </Button>
              {booking.status === "in_progress" && (
                <Button className="sm:col-span-2 bg-purple-600 hover:bg-purple-700 h-14 text-lg">
                  Mark as Completed
                </Button>
              )}
            </>
          )}
        </div>

        {/* Status Info */}
        <div className="mt-8 text-center text-slate-400 text-sm">
          {booking.status === "pending" && "Waiting for confirmation • Free cancellation until start time"}
          {booking.status === "accepted" && "Booking confirmed • Free cancellation up to 24h before"}
          {booking.status === "in_progress" && "Service in progress"}
          {booking.status === "completed" && "Booking completed • Review available"}
          {booking.status === "cancelled" && "Booking cancelled"}
        </div>
      </div>
    </div>
  );
}