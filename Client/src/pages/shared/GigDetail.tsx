/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Briefcase, Star, Loader2, MessageSquare, Calendar, User, CheckCircle2 } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_id: string;
  seller_name: string;
  seller_avatar_url?: string;
  seller_is_verified?: boolean;
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
        avatar_url,
        is_verified,
        rating,
        review_count
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Gig not found");

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  return {
    ...data,
    seller_name: profile?.full_name || "Unknown",
    seller_avatar_url: profile?.avatar_url,
    seller_is_verified: profile?.is_verified || false,
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

  // ── Direct Message Seller (fixed - starts new chat if none exists) ──
  const messageSeller = async () => {
    if (!user) {
      toast.error("Please log in to message the seller");
      return;
    }

    if (!gig?.seller_id) {
      toast.error("Seller information not loaded");
      return;
    }

    const sellerId = gig.seller_id;

    try {
      toast.info("Checking for existing conversation...");

      // Check for ANY direct message between buyer and seller
      const { data: existingThread, error: threadError } = await supabase
        .from("messages")
        .select("id")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${sellerId}),and(sender_id.eq.${sellerId},receiver_id.eq.${user.id})`
        )
        .limit(1);

      if (threadError) throw threadError;

      if (existingThread && existingThread.length > 0) {
        toast.success("Opening existing conversation...");
        navigate(`/chat/${sellerId}`);
        return;
      }

      // No existing thread → start new direct conversation
      const { error: insertError } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: sellerId,
          content: `Hello! I'm interested in your gig: "${gig.title}". Can we chat more about it?`,
          // No booking_id — this is a direct message
        });

      if (insertError) throw insertError;

      toast.success("New conversation started! Opening chat...");
      navigate(`/chat/${sellerId}`);
    } catch (err: any) {
      console.error("Messaging error:", err);
      toast.error("Failed to start conversation: " + (err.message || "Unknown error"));
    }
  };

  const goToSellerProfile = () => {
    if (!gig?.seller_id) return;
    navigate(`/seller-profile/${gig.seller_id}`);
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

        {/* Prominent Seller Block – Clickable to view profile/portfolio */}
        <div 
          className="mb-10 p-6 bg-slate-800/70 rounded-2xl border border-slate-700 hover:border-blue-600 transition-all cursor-pointer group shadow-lg"
          onClick={goToSellerProfile}
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative shrink-0">
              <Avatar className="h-24 w-24 md:h-28 md:w-28 ring-4 ring-blue-500/20">
                <AvatarImage src={gig.seller_avatar_url} alt={gig.seller_name} />
                <AvatarFallback className="text-3xl">{gig.seller_name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              {gig.seller_is_verified && (
                <div className="absolute -bottom-3 -right-3 bg-blue-600 p-2 rounded-full border-4 border-slate-900 shadow-md">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                <h3 className="text-2xl md:text-3xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  {gig.seller_name}
                </h3>
                {gig.seller_is_verified && (
                  <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-1 px-3 py-1">
                    <CheckCircle2 className="h-4 w-4" /> Verified Seller
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <span className="text-xl font-semibold text-white">
                  {gig.rating.toFixed(1)}
                </span>
                <span className="text-slate-400">
                  ({gig.review_count} {gig.review_count === 1 ? "review" : "reviews"})
                </span>
              </div>

              <Button 
                variant="outline" 
                className="border-blue-600 text-blue-400 hover:bg-blue-950 hover:text-blue-300 px-6 py-5 text-base font-medium"
              >
                View Profile & Portfolio <User className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
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