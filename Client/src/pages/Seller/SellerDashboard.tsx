// src/pages/seller/SellerDashboard.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  AlertCircle,
  Loader2,
  Briefcase,
  Users,
  Star,
  DollarSign,
  CreditCard,
  Mail,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type AvailabilitySlot = {
  id: string;
  seller_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

type Offer = {
  id: string;
  request_id: string;
  offered_price?: number;
  offered_start?: string;
  message?: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  job_requests: {
    id: string;
    title: string;
    description: string;
    budget?: number;
    category: string;
    buyer_id: string;
    profiles: {
      full_name: string;
    };
  };
};

type SellerStats = {
  activeGigs: number;
  activeBookings: number;
  completedBookings: number;
  rating: number;
  reviewCount: number;
  monthlyEarnings: number;
};

export default function SellerDashboard() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Form state for adding new availability slot
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");

  // Fetch seller stats
  const { 
    data: stats, 
    isLoading: statsLoading, 
    error: statsError 
  } = useQuery<SellerStats>({
    queryKey: ["seller-stats", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not logged in");

      const res = await fetch("/api/seller/dashboard", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load dashboard (${res.status})`);
      }

      return res.json();
    },
    enabled: !!userId,
  });

  // Fetch availability slots
  const { 
    data: slots = [], 
    isLoading: slotsLoading, 
    error: slotsError,
    refetch: refetchSlots 
  } = useQuery<AvailabilitySlot[]>({
    queryKey: ["seller-availability", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not logged in");

      const res = await fetch("/api/seller/availability", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load availability (${res.status})`);
      }

      return res.json();
    },
    enabled: !!userId,
  });

  // Fetch pending offers
  const { 
    data: offers = [], 
    isLoading: offersLoading, 
    error: offersError,
    refetch: refetchOffers 
  } = useQuery<Offer[]>({
    queryKey: ["seller-offers", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not logged in");

      const res = await fetch("/api/seller/offers", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load offers (${res.status})`);
      }

      return res.json();
    },
    enabled: !!userId,
  });

  // Mutation: Add new availability slot
  const addSlotMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) throw new Error("Please select a date first");

      const start = new Date(selectedDate);
      const [startH, startM] = startTime.split(":").map(Number);
      start.setHours(startH, startM, 0, 0);

      const end = new Date(selectedDate);
      const [endH, endM] = endTime.split(":").map(Number);
      end.setHours(endH, endM, 0, 0);

      if (isAfter(start, end) || isBefore(end, start)) {
        throw new Error("End time must be after start time");
      }

      const res = await fetch("/api/seller/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to add slot");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-availability", userId] });
      toast.success("Availability slot added");
      setNotes("");
      setStartTime("09:00");
      setEndTime("17:00");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add slot");
    },
  });

  // Mutation: Delete slot
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const res = await fetch(`/api/seller/availability/${slotId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete slot");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-availability", userId] });
      toast.success("Slot removed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove slot");
    },
  });

  // Mutation: Respond to offer (accept/reject)
  const respondOfferMutation = useMutation({
    mutationFn: async ({ offerId, action }: { offerId: string; action: "accept" | "reject" }) => {
      const res = await fetch(`/api/seller/offers/${offerId}/respond`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${action} offer`);
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seller-offers", userId] });
      toast.success(variables.action === "accept" ? "Offer accepted! Booking created." : "Offer rejected.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to respond to offer");
    },
  });

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    addSlotMutation.mutate();
  };

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  if (statsLoading || slotsLoading || offersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Seller Dashboard</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="space-y-6">
            <div className="h-12 bg-slate-800/50 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (statsError || slotsError || offersError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold mb-2">Failed to load dashboard</h2>
        <p className="text-slate-400 mb-6 text-center max-w-md">
          {(statsError as Error)?.message || (slotsError as Error)?.message || (offersError as Error)?.message}
        </p>
        <Button 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["seller-stats", userId] });
            queryClient.invalidateQueries({ queryKey: ["seller-availability", userId] });
            queryClient.invalidateQueries({ queryKey: ["seller-offers", userId] });
          }} 
          className="bg-blue-600 hover:bg-blue-700"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <h1 className="text-4xl font-bold text-white mb-2">Seller Dashboard</h1>
        <p className="text-slate-400 mb-10">Manage your gigs, bookings, availability, offers & earnings</p>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-slate-900/70 border-slate-700">
            <CardContent className="p-6 text-center">
              <Briefcase className="h-10 w-10 text-blue-400 mx-auto mb-4" />
              <p className="text-4xl font-bold text-white">{stats?.activeGigs ?? 0}</p>
              <p className="text-slate-400 mt-2">Active Gigs</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardContent className="p-6 text-center">
              <Users className="h-10 w-10 text-green-400 mx-auto mb-4" />
              <p className="text-4xl font-bold text-white">{stats?.activeBookings ?? 0}</p>
              <p className="text-slate-400 mt-2">Active Bookings</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardContent className="p-6 text-center">
              <Star className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
              <p className="text-4xl font-bold text-white">
                {stats?.rating?.toFixed(1) ?? "—"}
              </p>
              <p className="text-slate-400 mt-2">
                Rating ({stats?.reviewCount ?? 0})
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardContent className="p-6 text-center">
              <CreditCard className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
              <p className="text-4xl font-bold text-emerald-400">
                R{(stats?.monthlyEarnings ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-slate-400 mt-2">This Month</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Offers Section */}
        <Card className="bg-slate-900/70 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="h-5 w-5" />
              Pending Offers
            </CardTitle>
          </CardHeader>

          <CardContent>
            {offers.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700">
                <Mail className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">
                  No pending offers at the moment.
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  When admin sends you an offer for a job request, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {offers.map((offer) => (
                  <Card key={offer.id} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-2">
                            {offer.job_requests.title}
                          </h3>
                          <p className="text-sm text-slate-300 mb-3">
                            {offer.job_requests.description.substring(0, 150)}
                            {offer.job_requests.description.length > 150 ? "..." : ""}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">Category:</span>{" "}
                              <span className="text-slate-200">{offer.job_requests.category.replace(/_/g, " ")}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Buyer:</span>{" "}
                              <span className="text-slate-200">{offer.job_requests.profiles?.full_name || "Unknown"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Offered Price:</span>{" "}
                              <span className="text-emerald-400 font-medium">
                                {offer.offered_price ? `R${offer.offered_price.toLocaleString()}` : "Not specified"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Preferred Start:</span>{" "}
                              <span className="text-slate-200">
                                {offer.offered_start 
                                  ? format(parseISO(offer.offered_start), "MMM d, yyyy • h:mm a")
                                  : "Flexible"}
                              </span>
                            </div>
                          </div>

                          {offer.message && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                              <p className="text-sm text-slate-300 italic">
                                Admin note: "{offer.message}"
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row md:flex-col gap-3 md:w-40">
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => respondOfferMutation.mutate({ offerId: offer.id, action: "accept" })}
                            disabled={respondOfferMutation.isPending}
                          >
                            {respondOfferMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Accept
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-red-600 text-red-400 hover:bg-red-950/30"
                            onClick={() => respondOfferMutation.mutate({ offerId: offer.id, action: "reject" })}
                            disabled={respondOfferMutation.isPending}
                          >
                            {respondOfferMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manage Availability Section */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CalendarIcon className="h-5 w-5" />
              Manage Availability
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Calendar + Form */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Calendar */}
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4">Select Date</h3>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 inline-block">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={{ before: new Date() }}
                    className="text-white"
                    classNames={{
                      day: "text-slate-300 hover:bg-slate-700 rounded-full",
                      day_selected: "bg-blue-600 text-white",
                      day_disabled: "text-slate-600 opacity-50",
                      caption: "text-white font-medium",
                      head_cell: "text-slate-400",
                    }}
                  />
                </div>
              </div>

              {/* Add Slot Form */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="startTime" className="text-slate-200">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="endTime" className="text-slate-200">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-slate-200">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., prefer remote work, no weekends"
                    className="bg-slate-800 border-slate-700 text-white mt-2"
                  />
                </div>

                <Button
                  onClick={handleAddSlot}
                  disabled={
                    addSlotMutation.isPending ||
                    !selectedDate ||
                    !startTime ||
                    !endTime
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {addSlotMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Slot...
                    </>
                  ) : (
                    "Add Availability Slot"
                  )}
                </Button>
              </div>
            </div>

            {/* Current Slots */}
            <div>
              <h3 className="text-lg font-medium text-slate-200 mb-4">
                Your Current Availability Slots
              </h3>

              {slots.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700">
                  <CalendarIcon className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">
                    No availability slots added yet.
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    Add slots above to let buyers know when you're free.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-lg border ${
                        slot.is_booked
                          ? "bg-red-950/30 border-red-800"
                          : "bg-slate-800/50 border-slate-700"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium text-white">
                            {format(parseISO(slot.start_time), "MMM d, yyyy • h:mm a")} –{" "}
                            {format(parseISO(slot.end_time), "h:mm a")}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            {format(parseISO(slot.start_time), "EEEE")}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Remove this availability slot?")) {
                              deleteSlotMutation.mutate(slot.id);
                            }
                          }}
                          disabled={deleteSlotMutation.isPending || slot.is_booked}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                        >
                          {deleteSlotMutation.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </Button>
                      </div>

                      {slot.notes && (
                        <p className="text-sm text-slate-400 mt-2 border-t border-slate-700 pt-2">
                          {slot.notes}
                        </p>
                      )}

                      {slot.is_booked && (
                        <div className="mt-3 inline-block bg-red-900/50 text-red-300 text-xs px-2 py-1 rounded">
                          Booked – cannot delete
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}