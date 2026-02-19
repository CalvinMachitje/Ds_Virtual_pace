/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Buyer/MyBookings.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MessageSquare, Loader2, AlertCircle, Link } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  gig: {
    id: string;
    title: string;
    price: number;
  };
  seller: {
    id: string;
    full_name: string;
  };
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  price: number;
  requirements?: string;
  created_at: string;
  updated_at: string;
  reviewed: boolean; // true if buyer already left a review for this booking
};

export default function MyBookings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: bookings = [], isLoading, error } = useQuery<Booking[], Error>({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not logged in");

      const { data: rows, error } = await supabase
        .from("bookings")
        .select(`
          id, status, price, requirements, created_at, updated_at,
          gig:gig_id (id, title, price),
          seller:seller_id (id, full_name),
          reviewed:reviews!booking_id (id)  -- subquery to check if review exists
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (rows || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        price: r.price,
        requirements: r.requirements,
        created_at: r.created_at,
        updated_at: r.updated_at,
        gig: Array.isArray(r.gig) ? r.gig[0] : r.gig,
        seller: Array.isArray(r.seller) ? r.seller[0] : r.seller,
        reviewed: !!r.reviewed?.length, // true if any review exists for this booking
      })) as Booking[];

      return normalized;
    },
    enabled: !!user?.id,
  });

  // ────────────────────────────────────────────────
  // Real-time updates for booking status changes
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`buyer-bookings:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `buyer_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          const oldStatus = payload.old.status;
          const gigTitle = payload.new.gig?.title || "a gig";

          if (newStatus !== oldStatus) {
            if (newStatus === "accepted") {
              toast.success(`Your booking for "${gigTitle}" was accepted!`);
            } else if (newStatus === "rejected") {
              toast.error(`Your booking for "${gigTitle}" was rejected.`);
            } else if (newStatus === "completed") {
              toast.info(`Booking "${gigTitle}" marked as completed.`);
            }
          }

          // Refresh the list
          queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // ────────────────────────────────────────────────
  // Cancel booking mutation
  // ────────────────────────────────────────────────
  const cancelBooking = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      if (reason.trim().length < 10) {
        throw new Error("Please provide a reason (at least 10 characters)");
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancel_reason: reason.trim(),
        })
        .eq("id", bookingId)
        .eq("buyer_id", user.id)
        .eq("status", "pending"); // Only allow cancel if still pending

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled successfully");
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      setCancelReason("");
      setReasonError("");
      queryClient.invalidateQueries({ queryKey: ["my-bookings", user?.id] });
    },
    onError: (err: any) => {
      setReasonError(err.message || "Failed to cancel booking");
      toast.error(err.message || "Failed to cancel booking");
    },
  });

  // ────────────────────────────────────────────────
  // Submit review mutation
  // ────────────────────────────────────────────────
  const submitReview = useMutation({
    mutationFn: async () => {
      if (!selectedBooking || rating === 0 || !user?.id) {
        throw new Error("Invalid review data");
      }

      const { error } = await supabase.from("reviews").insert({
        booking_id: selectedBooking.id,
        reviewer_id: user.id,
        reviewed_id: selectedBooking.seller.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review submitted! Thank you.");
      setShowReviewModal(false);
      setRating(0);
      setComment("");
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ["my-bookings", user?.id] });
    },
    onError: (err: any) => {
      toast.error("Failed to submit review: " + (err.message || "Unknown error"));
    },
  });

  const handleCancelClick = (bookingId: string) => {
    setBookingToCancel(bookingId);
    setCancelReason("");
    setReasonError("");
    setCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    if (!bookingToCancel) return;

    if (cancelReason.trim().length < 10) {
      setReasonError("Reason must be at least 10 characters");
      return;
    }

    cancelBooking.mutate({ bookingId: bookingToCancel, reason: cancelReason });
  };

  const openReviewModal = (booking: Booking) => {
    if (booking.reviewed) {
      toast.info("You have already reviewed this booking.");
      return;
    }
    setSelectedBooking(booking);
    setRating(0);
    setComment("");
    setShowReviewModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">My Bookings</h1>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={160} className="rounded-xl" />
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
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ["my-bookings", user?.id] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">My Bookings</h1>

        {bookings.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">No bookings yet</p>
            <p className="mt-2">When you book a gig, it will appear here.</p>
            <Button asChild className="mt-6 bg-blue-600 hover:bg-blue-700">
              <Link to="/gigs">Browse Gigs</Link>
            </Button>
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
                        with {booking.seller.full_name}
                      </p>
                    </div>
                    <Badge
                      variant={
                        booking.status === "accepted" ? "default" :
                        booking.status === "rejected" || booking.status === "cancelled" ? "destructive" :
                        booking.status === "completed" ? "outline" :
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
                      Booked {new Date(booking.created_at).toLocaleDateString()}
                    </div>
                    <span className="font-medium text-emerald-400">
                      R{booking.price.toFixed(2)} / hour
                    </span>
                  </div>

                  {booking.requirements && (
                    <div className="text-sm text-slate-300 border-t border-slate-700 pt-3">
                      <strong className="block mb-1">Your requirements:</strong>
                      {booking.requirements}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 flex-wrap">
                    <Button variant="outline" size="sm" className="flex-1 min-w-[140px]">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message Seller
                    </Button>

                    {booking.status === "pending" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 min-w-[140px]"
                        onClick={() => handleCancelClick(booking.id)}
                      >
                        Cancel Request
                      </Button>
                    )}

                    {booking.status === "completed" && (
                      <Button
                        variant="default"
                        size="sm"
                        className={cn(
                          "flex-1 min-w-[140px]",
                          booking.reviewed ? "bg-slate-600 hover:bg-slate-700" : "bg-yellow-600 hover:bg-yellow-700"
                        )}
                        onClick={() => openReviewModal(booking)}
                        disabled={booking.reviewed}
                      >
                        {booking.reviewed ? "Already Reviewed" : "Leave Review"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking Request?</DialogTitle>
            <DialogDescription>
              This will cancel your request for "{bookings.find(b => b.id === bookingToCancel)?.gig.title}".
              The seller will be notified. Please tell us why you're cancelling (required).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cancel-reason" className="text-white">
                Reason for cancellation <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="e.g., Found a better option, Changed my mind, No longer need the service..."
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  setReasonError("");
                }}
                className="min-h-[100px] bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
              />
              {reasonError && (
                <p className="text-red-400 text-sm mt-1">{reasonError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelBooking.isPending || cancelReason.trim().length < 10}
            >
              {cancelBooking.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Submission Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Your Experience</DialogTitle>
            <DialogDescription>
              How would you rate {selectedBooking?.seller.full_name} for "{selectedBooking?.gig.title}"?
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {/* Star rating */}
            <div className="flex justify-center gap-2 text-4xl">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={cn(
                    "transition-colors",
                    star <= rating ? "text-yellow-400" : "text-slate-600 hover:text-yellow-400"
                  )}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Comment */}
            <div>
              <Label htmlFor="review-comment">Your feedback (optional)</Label>
              <Textarea
                id="review-comment"
                placeholder="Tell us about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[120px] bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => submitReview.mutate()}
              disabled={submitReview.isPending || rating === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitReview.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}