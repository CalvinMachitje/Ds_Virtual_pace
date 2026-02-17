// src/pages/shared/Chat.tsx
import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_file: boolean;
  file_url?: string;
  read_at?: string;
  created_at: string;
};

type UserProfile = {
  id: string;
  full_name: string;
  avatar_url?: string;
};

type BookingData = {
  id: string;
  buyer_id: string;
  seller_id: string;
  profiles: UserProfile;   // buyer
  profiles_1: UserProfile; // seller
};

export default function Chat() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [participants, setParticipants] = useState<{ buyer: UserProfile; seller: UserProfile } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch booking participants using correct foreign key names
  const { data: bookingData, isLoading: bookingLoading, error: bookingError } = useQuery<BookingData | null, Error>({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          buyer_id,
          seller_id,
          status,
          profiles!bookings_buyer_id_fkey (id, full_name, avatar_url),
          profiles_1!bookings_seller_id_fkey (id, full_name, avatar_url)
        `)
        .eq("id", bookingId)
        .maybeSingle();  // Use maybeSingle to return null on no row instead of error

      if (error) {
        console.warn("Booking fetch error:", error.message);
        return null;
      }

      if (!data) {
        console.warn("No booking found for ID:", bookingId);
        return null;
      }

      // Normalize profiles (they come as arrays in some cases)
      const buyerProfile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      const sellerProfile = Array.isArray(data.profiles_1) ? data.profiles_1[0] : data.profiles_1;

      return {
        ...data,
        profiles: buyerProfile ?? { id: "", full_name: "Unknown Buyer", avatar_url: "" },
        profiles_1: sellerProfile ?? { id: "", full_name: "Unknown Seller", avatar_url: "" },
      };
    },
    enabled: !!bookingId,
  });

  // Set participants from booking data
  useEffect(() => {
    if (bookingData) {
      setParticipants({
        buyer: bookingData.profiles,
        seller: bookingData.profiles_1,
      });
    }
  }, [bookingData]);

  // Fetch messages (always try, even if booking missing)
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<Message[], Error>({
    queryKey: ["messages", bookingId],
    queryFn: async () => {
      if (!bookingId) throw new Error("No conversation ID");

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!bookingId,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!bookingId || !user?.id) return;

    let mounted = true;

    const timer = setTimeout(async () => {
      if (!mounted) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) return;

      const channel = supabase
        .channel(`booking-messages:${bookingId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
          (payload) => {
            queryClient.setQueryData<Message[]>(["messages", bookingId], (old = []) => [
              ...old,
              payload.new as Message,
            ]);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        )
        .subscribe((status) => {
          console.log(`Realtime status for ${bookingId}: ${status}`);
        });

      return () => {
        if (mounted) {
          supabase.removeChannel(channel);
        }
      };
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [bookingId, user?.id, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user || !participants) throw new Error("User or participants not loaded");
      const receiverId = user.id === participants.buyer.id ? participants.seller.id : participants.buyer.id;

      const { error } = await supabase.from("messages").insert({
        booking_id: bookingId,
        sender_id: user.id,
        receiver_id: receiverId,
        content: messageText.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      toast.success("Message sent!");
    },
    onError: (err: any) => {
      toast.error("Failed to send message: " + err.message);
    },
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMessageMutation.mutate();
  };

  // Loading state
  if (bookingLoading || messagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton height={400} className="w-full max-w-3xl" />
      </div>
    );
  }

  // Error / missing booking fallback
  if (bookingError || !bookingData || !participants) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <MessageSquare className="h-16 w-16 mb-6 opacity-50" />
        <h2 className="text-2xl font-bold mb-4">Conversation Not Found</h2>
        <p className="text-center mb-8 max-w-md">
          This booking may not exist, was cancelled, or you don't have access to it.
        </p>
        <Button 
          onClick={() => window.history.back()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6 flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-12 w-12">
          <AvatarImage
            src={user.id === participants.buyer.id ? participants.seller.avatar_url : participants.buyer.avatar_url}
            alt={user.id === participants.buyer.id ? participants.seller.full_name : participants.buyer.full_name}
          />
          <AvatarFallback>
            {(user.id === participants.buyer.id ? participants.seller.full_name : participants.buyer.full_name)?.[0] || "?"}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold text-white">
          {user.id === participants.buyer.id ? participants.seller.full_name : participants.buyer.full_name}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-8">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`p-3 rounded-xl max-w-[70%] break-words ${
                    isMe ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {msg.content}
                  <div className="text-xs text-slate-400 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
        />
        <Button
          onClick={handleSend}
          className="bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
        >
          <Send className="h-5 w-5 rotate-90" />
        </Button>
      </div>
    </div>
  );
}