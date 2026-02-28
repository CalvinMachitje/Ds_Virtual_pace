/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/buyer/BuyerMessagesPage.tsx
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { MessageSquare, Plus, Bell, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { debounce } from "lodash";

type Conversation = {
  id: string;
  seller_name?: string;           // made optional
  seller_avatar?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  status: "pending" | "active" | "completed";
};

type Seller = {
  id: string;
  full_name: string;
  avatar_url?: string;
};

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  booking_id?: string;
};

const fetchBuyerConversations = async (buyerId: string): Promise<Conversation[]> => {
  const res = await fetch(`/api/buyer/conversations?buyer_id=${buyerId}`, {
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

const fetchSellers = async (search: string): Promise<Seller[]> => {
  if (search.trim().length < 2) return [];

  const res = await fetch(`/api/sellers/search?q=${encodeURIComponent(search)}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
    },
  });

  if (!res.ok) return [];
  return res.json();
};

export default function BuyerMessagesPage() {
  const { user } = useAuth();
  const buyerId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");
  const [sellerSearchResults, setSellerSearchResults] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [starterMessage, setStarterMessage] = useState("Hello! I'd like to discuss your gig.");
  const [notifications, setNotifications] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: conversations = [], isLoading, error } = useQuery<Conversation[]>({
    queryKey: ["buyer-conversations", buyerId],
    queryFn: () => fetchBuyerConversations(buyerId || ""),
    enabled: !!buyerId,
  });

  // Poll every 20 seconds
  useEffect(() => {
    if (!buyerId) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["buyer-conversations", buyerId] });
    }, 20000);

    return () => clearInterval(interval);
  }, [buyerId, queryClient]);

  // Debounced seller search
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.trim().length < 2) {
        setSellerSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const results = await fetchSellers(term);
      setSellerSearchResults(results);
      setIsSearching(false);
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(sellerSearch);
    return () => debouncedSearch.cancel();
  }, [sellerSearch, debouncedSearch]);

  // Safe filter – prevent crash if seller_name missing
  const filteredConversations = conversations.filter((conv) =>
    (conv.seller_name || "Unknown Seller").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartNewChat = async () => {
    if (!selectedSeller?.id) {
      toast.error("Please select a seller");
      return;
    }

    if (!starterMessage.trim()) {
      toast.error("Please enter a starter message");
      return;
    }

    setNewChatLoading(true);

    try {
      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({
          receiver_id: selectedSeller.id,
          content: starterMessage.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start conversation");
      }

      toast.success("Conversation started!");
      navigate(`/chat/${selectedSeller.id}`);
      setShowNewChatModal(false);
      setSelectedSeller(null);
      setSellerSearch("");
      setStarterMessage("Hello! I'd like to discuss your gig.");
      queryClient.invalidateQueries({ queryKey: ["buyer-conversations", buyerId] });
    } catch (err: any) {
      toast.error("Failed to start chat: " + err.message);
    } finally {
      setNewChatLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Failed to load messages</h2>
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
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">Your Messages</h1>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="relative text-slate-400 hover:text-white">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-slate-900/90 border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-400 py-4">No new notifications</p>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 border-b border-slate-700 last:border-0 hover:bg-slate-800">
                      <p className="text-sm text-white line-clamp-2">{notif.content}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(notif.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-4 border-t border-slate-700">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-slate-400 hover:text-white"
                    onClick={() => setNotifications([])}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
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
            <Button
              className="mt-6 bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowNewChatModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Start New Chat
            </Button>
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
                      <AvatarImage src={conv.seller_avatar} alt={conv.seller_name || "Seller"} />
                      <AvatarFallback>{(conv.seller_name || "?")[0]}</AvatarFallback>
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
                        {conv.seller_name || "Unknown Seller"}
                      </h3>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {conv.last_message_time || "—"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-1 mt-1">
                      {conv.last_message || "No messages yet"}
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

      {/* Start New Conversation Modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Search for a seller to begin chatting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Command className="bg-slate-900/60 border-slate-700">
              <CommandInput 
                placeholder="Search sellers by name..."
                value={sellerSearch}
                onValueChange={setSellerSearch}
                className="text-white placeholder:text-slate-500"
              />
              <CommandList>
                {isSearching ? (
                  <div className="p-4 text-center text-slate-400">Searching...</div>
                ) : sellerSearchResults.length === 0 && sellerSearch.trim().length >= 2 ? (
                  <div className="p-4 text-center text-slate-400">No sellers found</div>
                ) : (
                  sellerSearchResults.map((seller) => (
                    <CommandItem
                      key={seller.id}
                      onSelect={() => {
                        setSelectedSeller(seller);
                        setSellerSearch(seller.full_name);
                      }}
                      className="flex items-center gap-3 hover:bg-slate-800 cursor-pointer"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={seller.avatar_url} alt={seller.full_name} />
                        <AvatarFallback>{seller.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span>{seller.full_name}</span>
                    </CommandItem>
                  ))
                )}
              </CommandList>
            </Command>
            <Textarea
              placeholder="Your starter message..."
              value={starterMessage}
              onChange={(e) => setStarterMessage(e.target.value)}
              className="min-h-[100px] bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setShowNewChatModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartNewChat}
              disabled={newChatLoading || !selectedSeller?.id || !starterMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {newChatLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                "Send Message"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}