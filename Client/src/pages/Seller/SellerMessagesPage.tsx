// src/pages/seller/SellerMessagesPage.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, MessageSquare, Clock, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";

type Conversation = {
  id: string; // booking id
  client_name: string;
  client_avatar?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
};

const fetchSellerConversations = async (sellerId: string): Promise<Conversation[]> => {
  // Fetch bookings + last message + unread count per booking
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id,
      buyer_id,
      status,
      service,
      start_time,
      profiles!buyer_id (full_name, avatar_url)
    `)
    .eq("seller_id", sellerId)
    .order("start_time", { ascending: false });

  if (bookingsError) throw bookingsError;

  // For each booking, fetch last message and unread count
  const conversations = await Promise.all(
    (bookings || []).map(async (booking: any) => {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const { count: unread } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", booking.id)
        .eq("receiver_id", sellerId)
        .is("read_at", null);

      return {
        id: booking.id,
        client_name: booking.profiles?.full_name || "Client",
        client_avatar: booking.profiles?.avatar_url,
        last_message: lastMsg?.[0]?.content || "New booking request",
        last_message_time: lastMsg?.[0]?.created_at
          ? new Date(lastMsg[0].created_at).toLocaleString()
          : new Date(booking.start_time).toLocaleDateString(),
        unread_count: unread || 0,
        status: booking.status,
      };
    })
  );

  return conversations;
};

export default function SellerMessagesPage() {
  const { user } = useAuth();
  const sellerId = user?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations = [], isLoading, error, refetch } = useQuery<Conversation[]>({
    queryKey: ["seller-conversations", sellerId],
    queryFn: () => fetchSellerConversations(sellerId || ""),
    enabled: !!sellerId,
  });

  // Realtime: new message → refresh conversations
  useEffect(() => {
    if (!sellerId) return;

    const channel = supabase
      .channel(`seller-messages:${sellerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${sellerId}`,
        },
        (payload) => {
          queryClient.setQueryData<Conversation[]>(
            ["seller-conversations", sellerId],
            (old = []) => {
              return old.map(conv =>
                conv.id === payload.new.booking_id
                  ? { ...conv, unread_count: (conv.unread_count || 0) + 1 }
                  : conv
              );
            }
          );
          // Optional: toast for new message
          toast.info("New message received from a client");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sellerId, queryClient]);

  const filteredConversations = conversations.filter((conv) =>
    conv.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.last_message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        <div className="text-center">
          <p className="text-xl mb-4">Failed to load messages</p>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Seller Messages</h1>
        <p className="text-slate-400 mb-6">Manage incoming client messages and bookings</p>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search clients or messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <Tabs defaultValue="all" className="w-full sm:w-auto">
            <TabsList className="bg-slate-900/60 border border-slate-700">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-slate-900/70 rounded-xl p-4 flex gap-4">
                <Skeleton circle width={56} height={56} />
                <div className="flex-1">
                  <Skeleton width="60%" height={20} className="mb-2" />
                  <Skeleton width="80%" height={16} className="mb-2" />
                  <Skeleton width="40%" height={14} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">No messages yet</p>
            <p className="mt-2">When clients message you or book your gigs, conversations will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`} // booking ID as chat key
                className="block bg-slate-900/70 border border-slate-700 rounded-xl p-4 hover:border-blue-600 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={conv.client_avatar} alt={conv.client_name} />
                      <AvatarFallback>{conv.client_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    {conv.unread_count > 0 && (
                      <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                        {conv.unread_count > 99 ? "99+" : conv.unread_count}
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                        {conv.client_name}
                      </h3>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {conv.last_message_time}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-1 mt-1">
                      {conv.last_message}
                    </p>

                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {conv.status}
                      </Badge>
                      {conv.unread_count > 0 && (
                        <span className="text-xs text-red-400 font-medium">New message</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}