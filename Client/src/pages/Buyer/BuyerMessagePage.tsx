// src/pages/buyer/BuyerMessagesPage.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Conversation = {
  id: string; // booking id
  seller_name: string;
  seller_avatar?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  status: "pending" | "active" | "completed";
};

const fetchBuyerConversations = async (buyerId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      seller_id,
      status,
      start_time,
      profiles!seller_id (full_name, avatar_url)
    `)
    .eq("buyer_id", buyerId)
    .order("start_time", { ascending: false });

  if (error) throw error;

  return (data || []).map((booking: any) => ({
    id: booking.id,
    seller_name: booking.profiles?.full_name || "Seller",
    seller_avatar: booking.profiles?.avatar_url,
    last_message: "New booking or message", // can replace with real last message query
    last_message_time: new Date(booking.start_time).toLocaleDateString(),
    unread_count: Math.floor(Math.random() * 5), // replace with real unread count
    status: booking.status,
  }));
};

export default function BuyerMessagesPage() {
  const { user } = useAuth();
  const buyerId = user?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations = [], isLoading, error } = useQuery<Conversation[]>({
    queryKey: ["buyer-conversations", buyerId],
    queryFn: () => fetchBuyerConversations(buyerId || ""),
    enabled: !!buyerId,
  });

  // Listen for new messages to update unread count
  useEffect(() => {
    if (!buyerId) return;

    const channel = supabase
      .channel(`buyer-messages:${buyerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${buyerId}`,
        },
        (payload) => {
          queryClient.setQueryData<Conversation[]>(["buyer-conversations", buyerId], (old = []) =>
            old.map((conv) =>
              conv.id === payload.new.booking_id
                ? { ...conv, unread_count: (conv.unread_count || 0) + 1 }
                : conv
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [buyerId, queryClient]);

  const filteredConversations = conversations.filter((conv) =>
    conv.seller_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        <div className="text-center">
          <p className="text-xl mb-4">Failed to load messages</p>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => queryClient.refetchQueries({ queryKey: ["buyer-conversations"] })}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Your Messages</h1>
        <p className="text-slate-400 mb-6">Manage your conversations with sellers</p>

        <div className="relative mb-6">
          <Input
            placeholder="Search sellers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
          />
          <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
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
            <p className="text-xl font-medium">No conversations found</p>
            <p className="mt-2">Start booking gigs or messaging sellers to begin.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`} // reuse chat page for buyer
                className="block bg-slate-900/70 border border-slate-700 rounded-xl p-4 hover:border-blue-600 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={conv.seller_avatar} alt={conv.seller_name} />
                      <AvatarFallback>{conv.seller_name?.[0] || "?"}</AvatarFallback>
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
                        {conv.seller_name}
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
