// src/pages/shared/Chat.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Send,
  File,
  Download,
  Paperclip,
  Loader2,
  AlertCircle,
  X,
  Link,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_file: boolean;
  file_url?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  read_at?: string | null;
  created_at: string;
};

type UserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "buyer" | "seller";
};

// ── Component ────────────────────────────────────────────────────────────

export default function Chat() {
  const { sellerId: otherUserId } = useParams<{ sellerId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [hasConversationStarted, setHasConversationStarted] = useState<boolean | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);

  if (!otherUserId || !user?.id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center space-y-6 max-w-md">
          <AlertCircle className="h-16 w-16 mx-auto text-yellow-500" />
          <h2 className="text-2xl font-bold">Invalid or inaccessible chat</h2>
          <p className="text-slate-400">
            This conversation either doesn't exist, or you don't have permission to view it.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Load other user's profile + role ────────────────────────────────────
  const { data: directUser, isLoading: userLoading } = useQuery<UserProfile | null>({
    queryKey: ["user-profile", otherUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("id", otherUserId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!otherUserId,
  });

  useEffect(() => {
    if (directUser) setOtherUser(directUser);
  }, [directUser]);

  // ── Check if conversation has already been started by buyer ─────────────
  useEffect(() => {
    const checkConversation = async () => {
      if (!user?.id || !otherUserId) return;

      setLoadingAccess(true);

      // Check if there are any existing messages in this thread
      const { data: messages, error } = await supabase
        .from("messages")
        .select("id, sender_id")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .limit(1);

      if (error) {
        console.error("Error checking conversation:", error);
        toast.error("Failed to load conversation status");
        setHasConversationStarted(false);
      } else {
        const hasMessages = !!messages?.length;
        setHasConversationStarted(hasMessages);

        // If no messages yet, check who is trying to start it
        if (!hasMessages) {
          // Seller cannot initiate — only reply to existing buyer messages
          if (user.role === "seller") {
            toast.error("Sellers can only reply to messages started by buyers.");
            setHasConversationStarted(false);
          }
        }
      }

      setLoadingAccess(false);
    };

    checkConversation();
  }, [user?.id, otherUserId, user?.role]);

  // ── Fetch messages ──────────────────────────────────────────────────────
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["messages", user.id, otherUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!otherUserId && hasConversationStarted === true,
  });

  // ── Auto-mark messages as read on load ──────────────────────────────────
  useEffect(() => {
    if (!messages.length || !user?.id || hasConversationStarted !== true) return;

    const unreadIds = messages
      .filter((m) => m.receiver_id === user.id && !m.read_at)
      .map((m) => m.id);

    if (!unreadIds.length) return;

    // Optimistic UI update
    queryClient.setQueryData<Message[]>(["messages", user.id, otherUserId], (old = []) =>
      old.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m))
    );

    // Background update
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  }, [messages, user?.id, otherUserId, queryClient, hasConversationStarted]);

  // ── Real-time subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !otherUserId || hasConversationStarted !== true) return;

    const channelName = `dm-${[user.id, otherUserId].sort().join("-")}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `or(and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id}))`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;

          queryClient.setQueryData<Message[]>(["messages", user.id, otherUserId], (old = []) => {
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });

          if (newMsg.receiver_id === user.id && !newMsg.read_at) {
            await supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", newMsg.id);

            queryClient.setQueryData<Message[]>(["messages", user.id, otherUserId], (old = []) =>
              old.map((m) => (m.id === newMsg.id ? { ...m, read_at: new Date().toISOString() } : m))
            );
          }

          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, otherUserId, queryClient, hasConversationStarted]);

  // ── File upload helper ──────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
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

  // ── Send message mutation ───────────────────────────────────────────────
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!messageText.trim() && !selectedFile) {
        throw new Error("Cannot send empty message");
      }

      let payload: Partial<Message> = {
        sender_id: user.id,
        receiver_id: otherUserId,
      };

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
        payload = {
          ...payload,
          content: messageText.trim(),
          is_file: false,
        };
      }

      const { error } = await supabase.from("messages").insert(payload);
      if (error) throw error;

      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        sender_id: user.id,
        receiver_id: otherUserId,
        content: payload.content ?? "",
        is_file: payload.is_file ?? false,
        file_url: payload.file_url ?? null,
        mime_type: payload.mime_type ?? null,
        file_name: payload.file_name ?? null,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(["messages", user.id, otherUserId], (old = []) => [
        ...old,
        optimisticMsg,
      ]);
    },
    onSuccess: () => {
      setMessageText("");
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (err: any) => {
      toast.error("Failed to send message: " + (err.message || "Unknown error"));
    },
  });

  const handleSend = () => {
    sendMessageMutation.mutate();
  };

  // ── Loading / Access states ─────────────────────────────────────────────
  if (userLoading || loadingAccess || messagesLoading || !otherUser) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          <Skeleton height={80} />
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton circle width={48} height={48} />
                <div className="flex-1 space-y-2">
                  <Skeleton height={20} width="60%" />
                  <Skeleton height={60} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Seller trying to initiate new chat → blocked
  if (hasConversationStarted === false && user.role === "seller") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center space-y-6 max-w-lg">
          <AlertCircle className="h-20 w-20 mx-auto text-yellow-500" />
          <h1 className="text-3xl font-bold">Cannot Start Conversation</h1>
          <p className="text-lg text-slate-300">
            Sellers can only reply to messages that buyers have started.
          </p>
          <p className="text-slate-400">
            If you received a message from this buyer, it will appear in your inbox.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild variant="outline">
              <Link to={`/seller/${otherUserId}`}>View Profile</Link>
            </Button>
            <Button asChild>
              <Link to="/messages">Go to Messages</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col p-4 md:p-6">
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-700 mb-6 sticky top-0 bg-gradient-to-b from-slate-950/90 to-transparent backdrop-blur-sm z-10 py-2">
          <Avatar className="h-12 w-12 ring-2 ring-slate-700">
            <AvatarImage src={otherUser.avatar_url ?? undefined} alt={otherUser.full_name ?? ""} />
            <AvatarFallback className="bg-slate-700">
              {otherUser.full_name?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-white">{otherUser.full_name || "User"}</h2>
            <p className="text-sm text-slate-400">
              {otherUser.role === "seller" ? "Seller" : "Buyer"} • Direct Message
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-5 pr-2 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">No messages yet</p>
              <p className="text-sm mt-2">Send a message to start the conversation...</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user.id;
              const timestamp = new Date(msg.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    isMe ? "items-end ml-auto" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 break-words shadow-sm",
                      isMe
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-800 text-slate-100 rounded-bl-none"
                    )}
                  >
                    {msg.is_file && msg.file_url ? (
                      <div className="space-y-2">
                        {msg.mime_type?.startsWith("image/") ? (
                          <img
                            src={msg.file_url}
                            alt={msg.file_name || "Shared image"}
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(msg.file_url, "_blank")}
                          />
                        ) : (
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-slate-700/60 rounded-lg hover:bg-slate-700 transition-colors group"
                          >
                            <File className="h-8 w-8 text-slate-300 group-hover:text-blue-400 transition-colors" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{msg.file_name || "Attached file"}</p>
                              <p className="text-xs text-slate-400">
                                {msg.mime_type?.split("/").pop()?.toUpperCase() || "File"}
                              </p>
                            </div>
                            <Download className="h-5 w-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                          </a>
                        )}
                        {msg.content && msg.content !== msg.file_name && (
                          <p className="text-sm opacity-90 mt-2">{msg.content}</p>
                        )}
                      </div>
                    ) : (
                      <p className="leading-relaxed">{msg.content}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{timestamp}</span>
                    {isMe && msg.read_at && (
                      <span className="text-xs text-blue-400">✓✓</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Message Input Area */}
        <div className="border-t border-slate-700 pt-4 sticky bottom-0 bg-gradient-to-t from-slate-950 to-transparent backdrop-blur-sm">
          {selectedFile && (
            <div className="flex items-center gap-3 mb-3 bg-slate-800/70 p-3 rounded-lg">
              <File className="h-5 w-5 text-slate-300" />
              <span className="text-sm text-slate-200 truncate flex-1">{selectedFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-red-400"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || sendMessageMutation.isPending}
              className="text-slate-400 hover:text-slate-200"
            >
              {uploadingFile ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>

            <Input
              placeholder={selectedFile ? "Add optional message..." : "Type a message..."}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sendMessageMutation.isPending || uploadingFile}
              className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
            />

            <Button
              onClick={handleSend}
              disabled={
                sendMessageMutation.isPending ||
                uploadingFile ||
                (!messageText.trim() && !selectedFile)
              }
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 min-w-[48px]"
            >
              {sendMessageMutation.isPending || uploadingFile ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}