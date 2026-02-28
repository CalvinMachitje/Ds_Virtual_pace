// src/pages/shared/Chat.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";
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
import debounce from "lodash/debounce";

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
  booking_id?: string | null;
};

type UserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "buyer" | "seller";
};

// Socket.IO instance
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export default function Chat() {
  const { sellerId: otherUserId } = useParams<{ sellerId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [hasConversationStarted, setHasConversationStarted] = useState<boolean | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  if (!otherUserId || !user?.id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center space-y-6 max-w-md">
          <AlertCircle className="h-16 w-16 mx-auto text-yellow-500" />
          <h2 className="text-2xl font-bold">Invalid or inaccessible chat</h2>
          <p className="text-lg text-slate-300">
            This conversation either doesn't exist, or you don't have permission to view it.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Initialize Socket.IO ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Authentication required");
      navigate("/login");
      return;
    }

    socket = io(SOCKET_URL, {
      query: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("new_message", (msg: Message) => {
      if (msg.receiver_id !== user.id && msg.sender_id !== otherUserId) return;

      queryClient.setQueryData<Message[]>(["messages", user.id, otherUserId], (old = []) => {
        if (old.some((m) => m.id === msg.id)) return old;
        return [...old, msg];
      });

      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      if (msg.receiver_id === user.id && !msg.read_at) {
        socket?.emit("mark_read", {
          message_id: msg.id,
          booking_id: msg.booking_id,
        });
      }
    });

    socket.on("messages_read", (data: { message_id: string }) => {
      queryClient.setQueryData<Message[]>(["messages", user.id, otherUserId], (old = []) =>
        old.map((m) =>
          m.id === data.message_id ? { ...m, read_at: new Date().toISOString() } : m
        )
      );
    });

    socket.on("typing", (data: { sender_id: string }) => {
      if (data.sender_id === otherUserId) {
        setOtherUserTyping(true);
        setTimeout(() => setOtherUserTyping(false), 3000);
      }
    });

    socket.on("notification", (notif: { content: string }) => {
      toast.info(notif.content);
    });

    socket.on("error", (err: { message: string }) => {
      toast.error(err.message || "Socket error");
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [user?.id, otherUserId, navigate, queryClient]);

  // ── Load other user's profile ──────────────────────────────────────────
  const { data: directUser, isLoading: userLoading } = useQuery<UserProfile | null>({
    queryKey: ["user-profile", otherUserId],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${otherUserId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "User not found");
      }

      return res.json();
    },
    enabled: !!otherUserId,
  });

  useEffect(() => {
    if (directUser) setOtherUser(directUser);
  }, [directUser]);

  // ── Check if conversation exists & join room ───────────────────────────
  useEffect(() => {
    const checkAndJoin = async () => {
      if (!user?.id || !otherUserId || !socket?.connected) return;

      setLoadingAccess(true);

      try {
        const res = await fetch(`/api/messages/conversation/${otherUserId}/exists`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (!res.ok) throw new Error("Failed to check conversation");

        const { exists, booking_id } = await res.json();
        setHasConversationStarted(exists);

        if (exists) {
          const convId = booking_id || otherUserId;
          socket.emit("join_conversation", { conversation_id: convId });
          socket.emit("mark_read", { booking_id: convId });
        } else if (user.role === "seller") {
          toast.error("Sellers can only reply to messages started by buyers.");
        }
      } catch (err: any) {
        toast.error("Failed to load conversation status");
        setHasConversationStarted(false);
      } finally {
        setLoadingAccess(false);
      }
    };

    checkAndJoin();
  }, [user?.id, otherUserId, user?.role, socket?.connected]);

  // ── Fetch initial messages ─────────────────────────────────────────────
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["messages", user.id, otherUserId],
    queryFn: async () => {
      const res = await fetch(`/api/messages/conversation/${otherUserId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load messages");
      }

      return res.json();
    },
    enabled: !!user?.id && !!otherUserId && hasConversationStarted === true,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── File upload ────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/messages/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "File upload failed");
      }

      const { url, mime_type, file_name } = await res.json();
      return { url, mime_type, file_name };
    } catch (err: any) {
      toast.error("File upload failed: " + (err.message || "Unknown error"));
      throw err;
    } finally {
      setUploadingFile(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!messageText.trim() && !selectedFile) {
        throw new Error("Cannot send empty message");
      }

      if (!socket?.connected) {
        throw new Error("Socket not connected");
      }

      let payload: any = {
        receiver_id: otherUserId,
        content: messageText.trim(),
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
      }

      socket.emit("send_message", payload);

      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        sender_id: user!.id,
        receiver_id: otherUserId!,
        content: payload.content || "",
        is_file: payload.is_file || false,
        file_url: payload.file_url || null,
        mime_type: payload.mime_type || null,
        file_name: payload.file_name || null,
        read_at: null,
        created_at: new Date().toISOString(),
        booking_id: undefined,
      };

      queryClient.setQueryData<Message[]>(["messages", user!.id, otherUserId], (old = []) => [
        ...old,
        optimisticMsg,
      ]);

      setMessageText("");
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (err: any) => {
      toast.error("Failed to send message: " + (err.message || "Connection issue"));
    },
  });

  const handleSend = () => sendMessageMutation.mutate();

  // ── Typing indicator (debounced) ───────────────────────────────────────
  const emitTyping = useCallback(
    debounce(() => {
      if (socket?.connected && messageText.trim()) {
        socket.emit("typing", { receiver_id: otherUserId });
      }
    }, 500),
    [messageText, otherUserId]
  );

  useEffect(() => {
    emitTyping();
    return () => emitTyping.cancel();
  }, [messageText, emitTyping]);

  // ── Loading / Access states ─────────────────────────────────────────────
  if (userLoading || loadingAccess || messagesLoading || !otherUser) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
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

  if (hasConversationStarted === false && user.role === "seller") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 md:ml-64">
        <div className="text-center space-y-6 max-w-lg">
          <AlertCircle className="h-20 w-20 mx-auto text-yellow-500" />
          <h1 className="text-3xl font-bold">Cannot Start Conversation</h1>
          <p className="text-lg text-slate-300">
            Sellers can only reply to messages started by buyers.
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col p-4 md:p-6 md:ml-64">
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
              {otherUserTyping && <span className="ml-2 text-blue-400 animate-pulse">typing...</span>}
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
              onChange={(e) => {
                setMessageText(e.target.value);
                if (socket?.connected && e.target.value.trim()) {
                  socket.emit("typing", { receiver_id: otherUserId });
                }
              }}
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