// src/pages/shared/GigDetail.tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Briefcase, Star, Loader2, MessageSquare, Calendar } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_id: string;
  seller_name: string;
  rating: number;
  review_count: number;
  image_url?: string;
  created_at: string;
};

const fetchGigDetail = async (id: string) => {
  const { data, error } = await supabase
    .from("gigs")
    .select(`
      id,
      title,
      description,
      price,
      category,
      created_at,
      image_url,
      seller_id,
      profiles!seller_id (
        full_name,
        rating,
        review_count
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Gig not found");

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  return {
    ...data,
    seller_name: profile?.full_name || "Unknown",
    rating: profile?.rating || 0,
    review_count: profile?.review_count || 0,
  } as Gig;
};

export default function GigDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingNote, setBookingNote] = useState("");

  const { data: gig, isLoading, error, refetch } = useQuery<Gig>({
    queryKey: ["gig", id],
    queryFn: () => fetchGigDetail(id || ""),
    enabled: !!id,
  });

  // ── Booking Mutation ──
  const createBooking = useMutation({
    mutationFn: async () => {
      if (!user || !gig) throw new Error("User or gig not loaded");

      const { error } = await supabase
        .from("bookings")
        .insert({
          gig_id: gig.id,
          buyer_id: user.id,
          seller_id: gig.seller_id,
          price: gig.price,
          service: gig.title,
          start_time: new Date().toISOString(),
          end_time: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
          status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking request sent! Seller will review it soon.");
      setShowBookingModal(false);
      queryClient.invalidateQueries({ queryKey: ["my-bookings", user?.id] });
      navigate("/my-bookings");
    },
    onError: (err: any) => {
      toast.error("Failed to create booking: " + (err.message || "Unknown error"));
    },
  });

  // ── Direct Message Seller ──
  const messageSeller = async () => {
    if (!user) {
      toast.error("Please log in to message the seller");
      return;
    }

    if (!gig) {
      toast.error("Gig information not loaded");
      return;
    }

    try {
      toast.info("Checking for existing conversation...");

      // Check for existing direct message thread (no booking required)
      const { data: existingThread, error: threadError } = await supabase
        .from("messages")
        .select("id")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${gig.seller_id}),and(sender_id.eq.${gig.seller_id},receiver_id.eq.${user.id})`
        )
        .limit(1);

      if (threadError) throw threadError;

      if (existingThread && existingThread.length > 0) {
        toast.success("Opening existing conversation...");
        navigate(`/chat/${gig.seller_id}`);
        return;
      }

      // No thread yet → create first message to start conversation
      const { error: insertError } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: gig.seller_id,
          content: `Hello! Interested in your gig: ${gig.title}`,
          // no booking_id needed for direct chat
        });

      if (insertError) throw insertError;

      toast.success("Conversation started! Opening chat...");
      navigate(`/chat/${gig.seller_id}`);
    } catch (err: any) {
      console.error("Message error:", err);
      toast.error("Failed to start conversation: " + (err.message || "Unknown error"));
    }
  };

  if (isLoading) return <Skeleton className="min-h-screen" />;

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-red-400">
      <p>Failed to load gig</p>
      <Button onClick={() => refetch()}>Retry</Button>
    </div>
  );

  if (!gig) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-slate-400">
      <Briefcase className="h-16 w-16 mb-6 opacity-50" />
      <h2 className="text-2xl font-bold mb-2">Gig Not Found</h2>
      <Link to="/gigs">
        <Button>Browse All Gigs</Button>
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <img
          src={gig.image_url || "/placeholder-gig-large.jpg"}
          alt={gig.title}
          className="w-full h-64 md:h-96 object-cover rounded-xl mb-8"
        />

        <h1 className="text-4xl font-bold text-white mb-4">{gig.title}</h1>
        <Badge variant="secondary" className="mb-6 capitalize">{gig.category.replace(/_/g, " ")}</Badge>

        <p className="text-slate-300 mb-8 whitespace-pre-line">{gig.description}</p>

        <div className="flex items-center gap-4 mb-8">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-semibold">{gig.rating.toFixed(1)}</span>
          <span className="text-slate-400">({gig.review_count} reviews)</span>
          <span className="text-slate-400 ml-4">• By {gig.seller_name}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            variant="outline"
            className="flex-1 border-blue-600 text-blue-400 hover:bg-blue-950"
            onClick={messageSeller}
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Message Seller
          </Button>

          <Button
            onClick={() => setShowBookingModal(true)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Book Now – R{gig.price.toFixed(2)}/hr
          </Button>
        </div>

        {/* Booking Modal */}
        <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Booking</DialogTitle>
              <DialogDescription>
                You're booking <strong>{gig.title}</strong> with <strong>{gig.seller_name}</strong>
              </DialogDescription>
            </DialogHeader>
            <CardContent>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="note">Note to seller (optional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Any special requirements or questions?"
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </CardContent>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => setShowBookingModal(false)}>Cancel</Button>
              <Button
                onClick={() => createBooking.mutate()}
                disabled={createBooking.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {createBooking.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}