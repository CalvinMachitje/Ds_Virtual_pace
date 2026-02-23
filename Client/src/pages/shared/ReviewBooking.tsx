// src/pages/shared/ReviewBooking.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, DollarSign, CreditCard, ShieldCheck, Star } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";

type Booking = {
  id: string;
  seller_name: string;
  role: string;
  service: string;
  start_time: string;
  duration: number;
  price: number;
  fee: number;
  taxes: number;
  total: number;
  payment_method: string;
  avatar_url?: string;
};

export default function ReviewBooking() {
  const { id } = useParams<{ id: string }>();

  const { data: booking, isLoading, error, refetch } = useQuery<Booking>({
    queryKey: ["review-booking", id],
    queryFn: async () => {
      if (!id) throw new Error("No booking ID");

      const res = await fetch(`/api/bookings/${id}/review`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Booking not found");
      }

      return res.json();
    },
    enabled: !!id,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <p className="text-xl mb-4">Failed to load booking</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6 md:ml-64">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Review Booking</h1>
        <p className="text-slate-400 mb-8">Please confirm the details before payment</p>

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton height={120} />
            <Skeleton height={200} />
            <Skeleton height={180} />
            <Skeleton height={60} />
          </div>
        ) : !booking ? (
          <div className="text-center py-20 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">Booking not found</p>
            <p className="mt-2">This booking doesn't exist or was cancelled.</p>
          </div>
        ) : (
          <>
            {/* Worker summary */}
            <Card className="bg-slate-900/80 border-slate-700 backdrop-blur-md mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={booking.avatar_url} alt={booking.seller_name} />
                    <AvatarFallback>{booking.seller_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-white text-xl">{booking.seller_name}</h3>
                    <p className="text-slate-300">{booking.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-blue-600">{booking.service}</Badge>
                      <span className="text-slate-400">• R{booking.price.toFixed(2)}/hr</span>
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                      <span className="font-bold text-white">4.9</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking details */}
            <Card className="bg-slate-900/70 border-slate-700 mb-6">
              <CardHeader>
                <CardTitle className="text-xl text-white">Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="text-slate-400 text-sm">Date & Time</p>
                        <p className="text-white">{new Date(booking.start_time).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="text-slate-400 text-sm">Duration</p>
                        <p className="text-white">{booking.duration} hours</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="text-slate-400 text-sm">Rate</p>
                        <p className="text-white">
                          R{booking.price.toFixed(2)}/hr × {booking.duration} hrs = R{(booking.price * booking.duration).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="text-slate-400 text-sm">Service Fee + Taxes</p>
                        <p className="text-white">R{(booking.fee + booking.taxes).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-6 mt-6">
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-2xl font-bold text-green-400">R{booking.total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card className="bg-slate-900/70 border-slate-700 mb-8">
              <CardHeader>
                <CardTitle className="text-xl text-white">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-lg border border-slate-600">
                  <CreditCard className="h-8 w-8 text-blue-400" />
                  <div>
                    <p className="font-medium text-white">{booking.payment_method}</p>
                    <p className="text-slate-400 text-sm">Expires 12/26</p>
                  </div>
                  <Button variant="ghost" className="ml-auto text-blue-400">
                    Change
                  </Button>
                </div>

                <p className="text-sm text-slate-400 mt-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  Secure payment • Free cancellation up to 24h before
                </p>
              </CardContent>
            </Card>

            {/* Confirm button */}
            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-8 text-xl">
              Confirm and Pay R{booking.total.toFixed(2)}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}