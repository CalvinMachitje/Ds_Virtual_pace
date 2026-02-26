/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/seller/SellerMessagesPage.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
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

export default function SellerMessagesPage() {
  const { user } = useAuth();
  const sellerId = user?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations = [], isLoading, error, refetch } = useQuery<Conversation[]>({
    queryKey: ["seller-conversations", sellerId],
    queryFn: async () => {
      if (!sellerId) throw new Error("Not logged in");

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
    },
    enabled: !!sellerId,
  });

  // Poll for new messages/notifications every 20 seconds
  useEffect(() => {
    if (!sellerId) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["seller-conversations", sellerId] });
    }, 20000);

    return () => clearInterval(interval);
  }, [sellerId, queryClient]);

  const filteredConversations = conversations.filter((conv) =>
    conv.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.last_message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Failed to load messages</h2>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Seller Messages</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search clients or messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-700">
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
                    className="block bg-slate-900/70 border border-slate-700 rounded-xl p-4 hover:border-blue-600 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={conv.client_avatar} alt={conv.client_name} />
                          <AvatarFallback>{conv.client_name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        {conv.unread_count > 0 && (
                          <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 min-w-[1.25rem]">
                            {conv.unread_count > 99 ? "99+" : conv.unread_count}
                          </Badge>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-white truncate hover:text-blue-400 transition-colors">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}