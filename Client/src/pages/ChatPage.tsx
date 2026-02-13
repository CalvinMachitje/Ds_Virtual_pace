// src/pages/ChatPage.tsx
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Smile, Send, Phone, MoreVertical, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_file?: boolean;
  file_url?: string;
};

const fetchMessages = async (chatId: string) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("booking_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, error, refetch } = useQuery<Message[]>({
    queryKey: ["messages", chatId],
    queryFn: () => fetchMessages(chatId || ""),
    enabled: !!chatId && !!user,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          booking_id: chatId,
          sender_id: user?.id,
          receiver_id: "other-user-id", // Replace with real receiver logic (from booking)
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Message;
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ["messages", chatId] });
      const previous = queryClient.getQueryData<Message[]>(["messages", chatId]) || [];

      const optimisticMsg: Message = {
        id: "temp-" + Date.now(),
        content,
        sender_id: user?.id || "",
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(["messages", chatId], [...previous, optimisticMsg]);
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["messages", chatId], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${chatId}` },
        (payload) => {
          queryClient.setQueryData<Message[]>(["messages", chatId], (old = []) => [...old, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage.mutate(newMessage);
    setNewMessage("");
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load chat</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="/avatars/other.jpg" alt="Chat partner" />
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-white">Chat Partner</h3>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="h-2 w-2 bg-green-500 rounded-full inline-block" /> Online
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                {i % 2 !== 0 && <Skeleton circle width={32} height={32} className="mr-2 mt-1" />}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${i % 2 === 0 ? "bg-blue-600" : "bg-slate-800"}`}>
                  <Skeleton count={2} />
                  <Skeleton width="40%" className="mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">No messages yet</p>
            <p className="mt-2">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              {msg.sender_id !== user?.id && (
                <Avatar className="h-8 w-8 mt-1 mr-2">
                  <AvatarImage src="/avatars/other.jpg" />
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.sender_id === user?.id
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-slate-800 text-slate-100 rounded-bl-none"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.is_file && (
                  <div className="mt-2 bg-slate-900/50 p-2 rounded flex items-center gap-2 text-xs">
                    <Paperclip className="h-4 w-4" />
                    <span>{msg.file_url?.split("/").pop()}</span>
                  </div>
                )}
                <span className="text-xs opacity-70 block mt-1 text-right">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-slate-900/80 border-t border-slate-800 p-4">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon"><Paperclip className="h-5 w-5" /></Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Button variant="ghost" size="icon"><Smile className="h-5 w-5" /></Button>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}