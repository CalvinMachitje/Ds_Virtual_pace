// src/pages/shared/Chat.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, AlertCircle, Loader2, Paperclip, Download, File } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_file: boolean;
  file_url?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  duration?: number | null;
  read_at?: string | null;
  created_at: string;
  booking_id?: string | null;
};

type UserProfile = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
};

export default function Chat() {
  const { bookingId: paramId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [isDirectChat, setIsDirectChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Try to fetch as Booking ID ──
  const { data: bookingData, isLoading: bookingLoading, isFetched: bookingFetched } = useQuery({
    queryKey: ["booking", paramId],
    queryFn: async () => {
      if (!paramId) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          buyer_id,
          seller_id,
          profiles!bookings_buyer_id_fkey (id, full_name, avatar_url),
          profiles_1!bookings_seller_id_fkey (id, full_name, avatar_url)
        `)
        .eq("id", paramId)
        .maybeSingle();

      if (error || !data) return null;

      const buyer = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      const seller = Array.isArray(data.profiles_1) ? data.profiles_1[0] : data.profiles_1;

      return { id: data.id, buyer, seller };
    },
    retry: false,
    enabled: !!paramId,
  });

  // ── If no booking → treat as direct user ID ──
  const { data: directUser, isLoading: directLoading, isFetched: directFetched } = useQuery({
    queryKey: ["user-profile", paramId],
    queryFn: async () => {
      if (!paramId || bookingData) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", paramId)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: !!paramId && bookingFetched && !bookingData,
  });

  // ── Resolve chat partner ──
  useEffect(() => {
    if (bookingLoading || directLoading) return;

    if (bookingData) {
      const other = user?.id === bookingData.buyer.id ? bookingData.seller : bookingData.buyer;
      setOtherUser(other);
      setIsDirectChat(false);
    } else if (directUser) {
      setOtherUser(directUser);
      setIsDirectChat(true);
    } else if (bookingFetched && directFetched) {
      toast.error("Conversation not found or access denied");
      navigate(-1);
    }
  }, [bookingData, directUser, bookingLoading, directLoading, bookingFetched, directFetched, user?.id, navigate]);

  // ── Fetch messages ──
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["messages", paramId, isDirectChat],
    queryFn: async () => {
      if (!paramId) throw new Error("No conversation ID");

      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });

      if (isDirectChat) {
        query = query.or(
          `and(sender_id.eq.${user?.id},receiver_id.eq.${paramId}),and(sender_id.eq.${paramId},receiver_id.eq.${user?.id})`
        );
      } else {
        query = query.eq("booking_id", paramId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!paramId && !!user?.id && !!otherUser,
  });

  // ── Realtime subscription ──
  useEffect(() => {
    if (!paramId || !user?.id || !otherUser) return;

    const channelName = isDirectChat
      ? `chat-${[user.id, paramId].sort().join("-")}`
      : `booking-${paramId}`;

    const filter = isDirectChat
      ? `or(sender_id.eq.${user.id},receiver_id.eq.${user.id})`
      : `booking_id=eq.${paramId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter,
        },
        (payload) => {
          queryClient.setQueryData<Message[]>(["messages", paramId, isDirectChat], (old = []) => {
            if (old.some(m => m.id === payload.new.id)) return old;
            return [...old, payload.new as Message];
          });
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [paramId, user?.id, isDirectChat, otherUser, queryClient]);

  // ── File upload helper ──
  const uploadFile = async (file: File) => {
    if (!user) throw new Error("Not authenticated");

    setUploadingFile(true);
    try {
      const fileExt = file.name.split(".").pop() || "file";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `chat-files/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("chat-files").getPublicUrl(filePath);

      return {
        url: data.publicUrl,
        mime_type: file.type,
        file_name: file.name,
      };
    } catch (err: any) {
      toast.error("File upload failed: " + (err.message || "Unknown error"));
      throw err;
    } finally {
      setUploadingFile(false);
    }
  };

  // ── Send message (text or file) ──
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!otherUser) throw new Error("Chat partner not loaded");

      let payload: any = {
        sender_id: user.id,
        receiver_id: otherUser.id,
      };

      if (!isDirectChat && paramId) {
        payload.booking_id = paramId;
      }

      if (selectedFile) {
        const fileData = await uploadFile(selectedFile);
        payload = {
          ...payload,
          is_file: true,
          file_url: fileData.url,
          mime_type: fileData.mime_type,
          content: fileData.file_name || "File attached",
          file_name: fileData.file_name,
        };
        setSelectedFile(null);
      } else {
        if (!messageText.trim()) throw new Error("Message cannot be empty");
        payload = {
          ...payload,
          content: messageText.trim(),
          is_file: false,
        };
      }

      const { error } = await supabase.from("messages").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      setSelectedFile(null);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      toast.success("Message sent");
    },
    onError: (err: any) => {
      console.error("Send failed:", err);
      toast.error("Failed to send message: " + (err.message || "Unknown error"));
    },
  });

  const handleSend = () => {
    sendMessageMutation.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setSelectedFile(file);
  };

  // ── Render ──
  if (bookingLoading || (bookingFetched && !bookingData && directLoading) || (otherUser && messagesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-3xl">
          <Skeleton height={500} baseColor="#1e293b" highlightColor="#334155" />
        </div>
      </div>
    );
  }

  if (!otherUser && bookingFetched && directFetched) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 bg-slate-950 p-6">
        <AlertCircle className="h-16 w-16 mb-4 text-red-500" />
        <h2 className="text-xl font-bold text-white">Conversation Not Found</h2>
        <Button onClick={() => navigate(-1)} className="mt-4 bg-blue-600 hover:bg-blue-700">
          Go Back
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 bg-slate-950 p-6">
        <AlertCircle className="h-16 w-16 mb-4 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">Please log in</h2>
        <p className="text-center mt-4 max-w-md">
          You need to be signed in to view and send messages.
        </p>
        <Button onClick={() => navigate("/login")} className="mt-6 bg-blue-600 hover:bg-blue-700">
          Log In
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-700">
        <Avatar className="h-12 w-12">
          <AvatarImage src={otherUser?.avatar_url ?? undefined} />
          <AvatarFallback>{otherUser?.full_name?.[0] || "?"}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-bold text-white">{otherUser?.full_name}</h2>
          <p className="text-sm text-slate-400">
            {isDirectChat ? "Direct Message" : "Booking Chat"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 mt-20">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Start the conversation...</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMeMsg = msg.sender_id === user?.id;
            const timestamp = new Date(msg.created_at).toLocaleString("en-ZA", {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMeMsg ? "items-end" : "items-start"}`}
              >
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-2xl break-words",
                    isMeMsg
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-slate-800 text-slate-100 rounded-bl-none"
                  )}
                >
                  {msg.is_file && msg.file_url ? (
                    <div className="space-y-2">
                      {msg.mime_type?.startsWith("image/") ? (
                        <img
                          src={msg.file_url}
                          alt={msg.file_name || "Image"}
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.file_url, "_blank")}
                        />
                      ) : (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors"
                        >
                          <File className="h-6 w-6 text-slate-300" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {msg.file_name || "Attached file"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {msg.mime_type?.split("/").pop()?.toUpperCase() || "File"}
                            </p>
                          </div>
                          <Download className="h-5 w-5 text-slate-300" />
                        </a>
                      )}
                      {msg.content && msg.content !== msg.file_name && (
                        <p className="text-sm opacity-90">{msg.content}</p>
                      )}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>

                <span className="text-xs text-slate-500 mt-1 opacity-70">
                  {timestamp}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area with File Attachment */}
      <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) {
                toast.error("File too large (max 10MB)");
                e.target.value = ""; // clear input
                return;
              }
              setSelectedFile(file);
            }
          }}
          className="hidden"
          accept="*/*"
        />

        {/* Attach button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile || sendMessageMutation.isPending}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {uploadingFile ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </Button>

        {/* Selected file preview */}
        {selectedFile && (
          <div className="flex-1 flex items-center gap-2 text-sm text-slate-300 truncate pr-2">
            <File className="h-4 w-4" />
            <span className="truncate">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-red-400"
              onClick={() => setSelectedFile(null)}
            >
              ×
            </Button>
          </div>
        )}

        {/* Text input */}
        <Input
          placeholder={selectedFile ? "Add message or send file..." : "Type a message..."}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
          className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          disabled={sendMessageMutation.isPending || uploadingFile}
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={
            sendMessageMutation.isPending ||
            uploadingFile ||
            (!messageText.trim() && !selectedFile)
          }
          className="bg-blue-600 hover:bg-blue-700 min-w-[44px]"
        >
          {sendMessageMutation.isPending || uploadingFile ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5 rotate-[-30deg]" />
          )}
        </Button>
      </div>
    </div>
  );
}