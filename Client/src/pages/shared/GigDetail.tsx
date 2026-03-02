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
import { Input } from "@/components/ui/input";
import { Briefcase, Star, Loader2, MessageSquare, Calendar as CalendarIcon, User, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NavLayout from "@/components/layout/NavLayout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore } from "date-fns";
import { cn } from "@/lib/utils";

type Gig = {
  id: string;
  title: string;
  description: string;
  price?: number | null;
  category: string;
  seller_id: string;
  seller_name: string;
  seller_avatar_url?: string;
  seller_is_verified?: boolean;
  rating?: number | null;
  review_count: number;
  image_url?: string;
  created_at: string;
  // Optional: if you later fetch more seller data
  seller_bio?: string | null;
  seller_portfolio_images?: string[] | null;
};

export default function GigDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingNote, setBookingNote] = useState("");

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDesc, setRequestDesc] = useState("");
  const [requestBudget, setRequestBudget] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // NEW: Quick seller preview modal
  const [showSellerPreviewModal, setShowSellerPreviewModal] = useState(false);

  const { data: gig, isLoading, error } = useQuery<Gig>({
    queryKey: ["gig", id],
    queryFn: async () => {
      if (!id) throw new Error("No gig ID");

      const res = await fetch(`/api/gigs/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gig not found");
      }

      return res.json();
    },
    enabled: !!id,
  });

  // Booking mutation
  const createBooking = useMutation({
    mutationFn: async () => {
      if (!user || !gig) throw new Error("User or gig not loaded");

      const res = await fetch("/api/buyer/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({
          gig_id: gig.id,
          price: gig.price ?? 0,
          service: gig.title,
          note: bookingNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create booking");
      }

      return res.json();
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

  console.log("Sending request with token:", localStorage.getItem("access_token") || "NO TOKEN");

  // Hire request mutation
  const hireRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user || !gig) throw new Error("Not authenticated or gig not loaded");

      if (!requestTitle.trim() || !requestDesc.trim()) {
        throw new Error("Title and description are required");
      }

      if (!startDate) {
        throw new Error("Preferred start date is required");
      }

      if (dueDate && isBefore(dueDate, startDate)) {
        throw new Error("Estimated due date must be after preferred start date");
      }

      const payload = {
        category: gig.category,
        title: requestTitle.trim(),
        description: requestDesc.trim(),
        budget: requestBudget ? Number(requestBudget) : null,
        preferred_start_time: startDate ? startDate.toISOString() : null,
        estimated_due_time: dueDate ? dueDate.toISOString() : null,
        seller_id: gig.seller_id,
      };

      const res = await fetch("/api/buyer/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit request");
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Request submitted successfully! Admin will review and assign a seller.");
      setShowRequestModal(false);
      setRequestTitle("");
      setRequestDesc("");
      setRequestBudget("");
      setStartDate(undefined);
      setDueDate(undefined);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit request");
    },
  });

  const messageSeller = () => {
    if (!user) {
      toast.error("Please log in to message the seller");
      return;
    }

    if (!gig?.seller_id) {
      toast.error("Seller information not loaded");
      return;
    }

    navigate(`/chat/${gig.seller_id}`);
  };

  const goToSellerProfile = () => {
    if (!gig?.seller_id) return;
    navigate(`/seller-profile/${gig.seller_id}`);
  };

  if (isLoading) return <Skeleton className="min-h-screen" />;

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-red-400">
      <p>Failed to load gig</p>
      <Button onClick={() => window.location.reload()}>Retry</Button>
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

  // Safe price & rating display
  const displayPrice = gig.price != null && !isNaN(Number(gig.price))
    ? `R${Number(gig.price).toFixed(2)}/hr`
    : "Contact for price";

  const displayRating = gig.rating != null && !isNaN(Number(gig.rating))
    ? Number(gig.rating).toFixed(1)
    : "—";

  // Bio preview (truncate if too long)
  const bioPreview = gig.seller_bio
    ? gig.seller_bio.length > 120
      ? gig.seller_bio.substring(0, 117) + "..."
      : gig.seller_bio
    : "No bio available yet.";

  return (
    <NavLayout>
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

          {/* Quick Seller Preview Card */}
          <Card className="mb-8 bg-slate-800/70 border-slate-700 hover:border-blue-600 transition-all shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-blue-500/20">
                    <AvatarImage src={gig.seller_avatar_url} alt={gig.seller_name} />
                    <AvatarFallback className="text-4xl">{gig.seller_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  {gig.seller_is_verified && (
                    <div className="absolute -bottom-2 -right-2 bg-blue-600 p-1.5 rounded-full border-4 border-slate-900 shadow-md">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {gig.seller_name}
                    </h3>
                    {gig.seller_is_verified && (
                      <Badge className="bg-blue-600 text-white text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                    <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-lg font-semibold text-white">
                      {displayRating}
                    </span>
                    <span className="text-slate-400 text-sm">
                      ({gig.review_count ?? 0} reviews)
                    </span>
                  </div>

                  <p className="text-slate-300 mb-4 line-clamp-2">
                    {bioPreview}
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {/* NEW: Quick Preview Modal Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-300 hover:text-white"
                      onClick={() => setShowSellerPreviewModal(true)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Quick Preview
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safe price display */}
          <div className="text-3xl font-bold text-emerald-400 mb-6">
            {displayPrice}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <Button
              variant="outline"
              className="flex-1 border-blue-600 text-blue-400 hover:bg-blue-950"
              onClick={messageSeller}
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Message Seller
            </Button>

            <Button
              variant="default"
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                if (!user) {
                  toast.error("Please log in to send a request");
                  navigate("/login");
                  return;
                }
                setRequestTitle(`Hire for ${gig.title}`);
                setRequestDesc("");
                setRequestBudget("");
                setStartDate(undefined);
                setDueDate(undefined);
                setShowRequestModal(true);
              }}
              disabled={isLoading || !gig || !user}
            >
              <Briefcase className="mr-2 h-5 w-5" />
              Request to Hire
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

          {/* Request Modal */}
          <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  Request Service from {gig.seller_name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div>
                  <Label className="text-slate-200 mb-2 block">Title</Label>
                  <Input
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    placeholder="e.g., Need logo design for new brand"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-slate-200 mb-2 block">Description</Label>
                  <Textarea
                    value={requestDesc}
                    onChange={(e) => setRequestDesc(e.target.value)}
                    placeholder="Describe what you need, any specific requirements, etc."
                    className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-slate-200 mb-2 block">Budget (R) - optional</Label>
                    <Input
                      type="number"
                      value={requestBudget}
                      onChange={(e) => setRequestBudget(e.target.value)}
                      placeholder="e.g., 500"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <Label className="text-slate-200 mb-2 block">Preferred Start Date & Time *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white",
                            !startDate && "text-slate-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP p") : <span>Pick start date & time</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            if (date) {
                              const newDate = new Date(date);
                              newDate.setHours(startDate?.getHours() || 9, startDate?.getMinutes() || 0);
                              setStartDate(newDate);
                            }
                          }}
                          initialFocus
                          disabled={(date) => date < new Date()}
                        />
                        {startDate && (
                          <div className="p-3 border-t border-slate-700">
                            <Label className="text-slate-200 mb-2 block text-sm">Time</Label>
                            <Input
                              type="time"
                              value={format(startDate, "HH:mm")}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(":").map(Number);
                                const newDate = new Date(startDate);
                                newDate.setHours(hours, minutes);
                                setStartDate(newDate);
                              }}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="text-slate-200 mb-2 block">Estimated Due Date & Time (optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white",
                            !dueDate && "text-slate-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP p") : <span>Pick due date & time</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={(date) => {
                            if (date) {
                              const newDate = new Date(date);
                              newDate.setHours(dueDate?.getHours() || 17, dueDate?.getMinutes() || 0);
                              setDueDate(newDate);
                            }
                          }}
                          initialFocus
                          disabled={(date) => startDate ? isBefore(date, startDate) : isBefore(date, new Date())}
                        />
                        {dueDate && (
                          <div className="p-3 border-t border-slate-700">
                            <Label className="text-slate-200 mb-2 block text-sm">Time</Label>
                            <Input
                              type="time"
                              value={format(dueDate, "HH:mm")}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(":").map(Number);
                                const newDate = new Date(dueDate);
                                newDate.setHours(hours, minutes);
                                setDueDate(newDate);
                              }}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <p className="text-sm text-slate-400">
                  Your request will be reviewed by admin. A suitable seller will be assigned.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowRequestModal(false)}
                  className="border-slate-600 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!requestTitle.trim() || !requestDesc.trim() || !startDate) {
                      toast.error("Title, description, and start date are required");
                      return;
                    }
                    setSubmittingRequest(true);
                    hireRequestMutation.mutate();
                    setSubmittingRequest(false);
                  }}
                  disabled={submittingRequest || !requestTitle.trim() || !requestDesc.trim() || !startDate}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {submittingRequest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* NEW: Quick Seller Preview Modal */}
          <Dialog open={showSellerPreviewModal} onOpenChange={setShowSellerPreviewModal}>
            <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={gig.seller_avatar_url} alt={gig.seller_name} />
                    <AvatarFallback>{gig.seller_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  {gig.seller_name}
                  {gig.seller_is_verified && (
                    <Badge className="bg-blue-600 text-white text-xs ml-2">
                      Verified
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-6">
                {/* Rating */}
                <div className="flex items-center justify-center gap-3">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          "h-5 w-5",
                          s <= Math.round(gig.rating || 0)
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-700"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xl font-semibold">
                    {displayRating}
                  </span>
                  <span className="text-slate-400">
                    ({gig.review_count ?? 0} reviews)
                  </span>
                </div>

                {/* Bio */}
                <div>
                  <Label className="text-slate-300 mb-2 block text-sm">About</Label>
                  <p className="text-slate-200 leading-relaxed text-sm line-clamp-4">
                    {gig.seller_bio || "No bio available yet."}
                  </p>
                </div>

                {/* Portfolio Preview (thumbnails) */}
                {gig.seller_portfolio_images && gig.seller_portfolio_images.length > 0 && (
                  <div>
                    <Label className="text-slate-300 mb-2 block text-sm">Portfolio Preview</Label>
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                      {gig.seller_portfolio_images.slice(0, 4).map((img, idx) => (
                        <div
                          key={idx}
                          className="flex-none w-24 h-24 rounded-lg overflow-hidden border border-slate-700 snap-center"
                        >
                          <img
                            src={img}
                            alt={`Portfolio ${idx + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                      {gig.seller_portfolio_images.length > 4 && (
                        <div className="flex-none w-24 h-24 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-xs border border-slate-700">
                          +{gig.seller_portfolio_images.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact hint */}
                <p className="text-sm text-slate-400 italic text-center">
                  Full contact details and messaging available after admin confirmation
                </p>
              </div>

              <DialogFooter className="sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setShowSellerPreviewModal(false)}
                  className="border-slate-600 hover:bg-slate-800"
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </NavLayout>
  );
}