// src/pages/shared/ManageBookings.tsx
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Mail } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Booking = {
  id: string;
  client_name: string;
  role: string;
  service: string;
  status: "In Progress" | "Pending" | "Completed";
  time: string;
  avatar_url?: string;
};

export default function ManageBookings() {
  const { data, isLoading, error, refetch } = useQuery<{
    active: Booking[];
    completed: Booking[];
  }>({
    queryKey: ["manage-bookings"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/manage", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load bookings");
      }

      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load bookings</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  const activeBookings = data?.active ?? [];
  const completedBookings = data?.completed ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">Manage Bookings</h1>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900/60 border border-slate-700 mb-6 rounded-lg overflow-hidden">
            <TabsTrigger value="active" className="text-base py-3">
              Active
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-base py-3">
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
            {isLoading ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-slate-900/70 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      <Skeleton circle width={56} height={56} />
                      <div className="flex-1">
                        <Skeleton width="65%" height={24} className="mb-2" />
                        <Skeleton width="45%" height={16} className="mb-3" />
                        <Skeleton count={3} height={20} className="mb-2" />
                      </div>
                    </div>
                    <Skeleton height={48} className="mt-5 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : activeBookings.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">No active bookings</p>
                <p className="mt-2">When clients book your services, they'll appear here.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {activeBookings.map((booking) => (
                  <Card
                    key={booking.id}
                    className="bg-slate-900/70 border-slate-700 backdrop-blur-sm hover:border-blue-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-blue-950/20"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 ring-1 ring-slate-700">
                          <AvatarImage src={booking.avatar_url} alt={booking.client_name} />
                          <AvatarFallback className="bg-slate-800 text-slate-300">
                            {booking.client_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                            <div>
                              <h3 className="font-semibold text-white truncate">
                                {booking.client_name}
                              </h3>
                              <p className="text-slate-400 text-sm">{booking.role}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-3 py-1 text-xs font-medium",
                                booking.status === "In Progress" && "bg-blue-950/60 text-blue-300 border-blue-700",
                                booking.status === "Pending" && "bg-amber-950/60 text-amber-300 border-amber-700"
                              )}
                            >
                              {booking.status}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm text-slate-300">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-slate-500" />
                              <span className="truncate">{booking.service}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-500" />
                              <span>{booking.time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="px-5 pb-5 pt-0">
                      <Button
                        variant="outline"
                        className="w-full border-slate-600 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        View Details & Chat
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-0">
            {isLoading ? (
              <div className="space-y-6">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      <Skeleton circle width={56} height={56} />
                      <div className="flex-1">
                        <Skeleton width="60%" height={24} className="mb-2" />
                        <Skeleton width="40%" height={16} className="mb-3" />
                        <Skeleton count={3} height={20} className="mb-2" />
                      </div>
                    </div>
                    <Skeleton height={48} className="mt-5 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : completedBookings.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">No completed bookings yet</p>
                <p className="mt-2">Once bookings are finished, they'll appear here.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {completedBookings.map((booking) => (
                  <Card
                    key={booking.id}
                    className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-green-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-green-950/20 opacity-90"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 ring-1 ring-slate-700">
                          <AvatarImage src={booking.avatar_url} alt={booking.client_name} />
                          <AvatarFallback className="bg-slate-800 text-slate-300">
                            {booking.client_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                            <div>
                              <h3 className="font-semibold text-white truncate">
                                {booking.client_name}
                              </h3>
                              <p className="text-slate-400 text-sm">{booking.role}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className="px-3 py-1 text-xs font-medium bg-green-950/60 text-green-300 border-green-700"
                            >
                              Completed
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm text-slate-300">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-slate-500" />
                              <span className="truncate">{booking.service}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-500" />
                              <span>{booking.time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="px-5 pb-5 pt-0">
                      <Button
                        variant="outline"
                        className="w-full border-slate-600 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        View Details & Feedback
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}