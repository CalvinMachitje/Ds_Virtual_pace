/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/seller/SellerMessagesPage.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";

type Conversation = {
  id: string;
  client_name?: string;           // made optional to avoid crashes
  client_avatar?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
};

const fetchSellerConversations = async (sellerId: string): Promise<Conversation[]> => {
  const res = await fetch("/api/seller/conversations", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to load conversations");
  }

  return res.json();
};

export default function SellerMessagesPage() {
  const { user } = useAuth();
  const sellerId = user?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations = [], isLoading, error } = useQuery<Conversation[]>({
    queryKey: ["seller-conversations", sellerId],
    queryFn: () => fetchSellerConversations(sellerId || ""),
    enabled: !!sellerId,
  });

  // Poll for new messages every 20 seconds
  useEffect(() => {
    if (!sellerId) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["seller-conversations", sellerId] });
    }, 20000);

    return () => clearInterval(interval);
  }, [sellerId, queryClient]);

  // Safe filter – handle missing client_name
  const filteredConversations = conversations.filter((conv) =>
    (conv.client_name || "Unknown Client").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Failed to load messages</h2>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => queryClient.refetchQueries({ queryKey: ["seller-conversations", sellerId] })}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">My Messages</h1>

        <div className="relative mb-6">
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
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
                to={`/chat/${conv.id}`}
                className="block bg-slate-900/70 border border-slate-700 rounded-xl p-4 hover:border-blue-600 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={conv.client_avatar} alt={conv.client_name || "Client"} />
                      <AvatarFallback>{(conv.client_name || "?")[0]}</AvatarFallback>
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
                        {conv.client_name || "Unknown Client"}
                      </h3>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {conv.last_message_time}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-1 mt-1">
                      {conv.last_message || "No message yet"}
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