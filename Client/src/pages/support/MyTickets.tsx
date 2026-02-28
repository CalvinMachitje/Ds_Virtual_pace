/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/support/MyTickets.tsx
import { useInfiniteQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, RefreshCw, Search as SearchIcon, X, Eye, AlertCircle, Plus, Loader2 } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import NavLayout from "@/components/layout/NavLayout";
import { apiFetch } from "@/lib/api"; // Make sure this file exists
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: "open" | "resolved" | "escalated" | "closed";
  created_at: string;
};

const PAGE_SIZE = 9;

export default function MyTickets() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState<string>("");
  const [relatedId, setRelatedId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<"newest" | "oldest">("newest");

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["my-tickets"],
    queryFn: async ({ pageParam = 0 }) => {
      const json = await apiFetch(`/support/my-tickets?page=${pageParam}&limit=${PAGE_SIZE}`);
      return json;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    staleTime: 5 * 60 * 1000,
  });

  const allTickets = useMemo(() => data?.pages.flatMap((p: any) => p.tickets || []) ?? [], [data]);

  const statuses = ["open", "resolved", "escalated", "closed"];

  // ────────────────────────────────────────────────
  // Filtered & Sorted Tickets
  // ────────────────────────────────────────────────
  const processedTickets = useMemo(() => {
    let result = [...allTickets];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (ticket) =>
          ticket.subject?.toLowerCase().includes(term) ||
          ticket.description?.toLowerCase().includes(term)
      );
    }

    if (selectedStatus) {
      result = result.filter((ticket) => ticket.status === selectedStatus);
    }

    switch (sortOption) {
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      default: // newest
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [allTickets, searchTerm, selectedStatus, sortOption]);

  // ────────────────────────────────────────────────
  // Create Ticket Mutation
  // ────────────────────────────────────────────────
  const createTicket = useMutation({
    mutationFn: async () => {
      if (!subject.trim()) throw new Error("Subject is required");
      if (!description.trim()) throw new Error("Description is required");
      if (description.trim().length < 20) {
        throw new Error("Description must be at least 20 characters");
      }

      const payload = {
        subject: subject.trim(),
        description: description.trim(),
        priority,
        category: category || undefined,
        related_id: relatedId.trim() || undefined,
      };

      const json = await apiFetch("/support", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return json;
    },
    onSuccess: () => {
      toast.success("Ticket created successfully");
      setCreateDialogOpen(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      setCategory("");
      setRelatedId("");
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (err: any) => {
      toast.error("Failed to create ticket", {
        description: err.message || "An unexpected error occurred. Please try again.",
      });
    },
  });

  const handleCreate = () => createTicket.mutate();

  // ────────────────────────────────────────────────
  // Infinite Scroll
  // ────────────────────────────────────────────────
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    }, 60000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  const noResultsMessage = () => {
    if (searchTerm && !selectedStatus) {
      return `No tickets match your search for "${searchTerm}"`;
    }
    if (searchTerm || selectedStatus) {
      return "No tickets match the current filters";
    }
    return "No tickets found";
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h1 className="text-4xl font-bold text-white">My Support Tickets</h1>

            {/* Floating New Ticket Button */}
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={createTicket.isPending}
              className="fixed bottom-8 right-8 z-50 rounded-full w-14 h-14 shadow-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center md:static md:w-auto md:h-auto md:rounded-md md:px-6"
            >
              <Plus className="h-6 w-6 md:mr-2" />
              <span className="hidden md:inline">New Ticket</span>
            </Button>
          </div>

          {/* Controls */}
          <div className="mb-8 space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search tickets by subject or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as any)}>
                <SelectTrigger className="w-full sm:w-48 bg-slate-900/60 border-slate-700 text-white">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedStatus === null ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-3 py-1 text-sm",
                    selectedStatus === null && "bg-blue-600 hover:bg-blue-700"
                  )}
                  onClick={() => setSelectedStatus(null)}
                >
                  All
                </Badge>

                {statuses.map((status) => (
                  <Badge
                    key={status}
                    variant={selectedStatus === status ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer px-3 py-1 text-sm capitalize",
                      selectedStatus === status && "bg-blue-600 hover:bg-blue-700"
                    )}
                    onClick={() => setSelectedStatus(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                ))}
              </div>

              {(searchTerm || selectedStatus) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedStatus(null);
                    setSortOption("newest");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          {isLoading && allTickets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <Skeleton key={i} height={340} className="rounded-xl" />
              ))}
            </div>
          ) : processedTickets.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-medium">{noResultsMessage()}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {processedTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="bg-slate-900/70 border-slate-700 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-950/30 transition-all duration-300 overflow-hidden group"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge
                          variant={
                            ticket.status === "open" ? "outline" :
                            ticket.status === "resolved" ? "secondary" :
                            ticket.status === "escalated" ? "destructive" : "default"
                          }
                          className={cn(
                            "px-3 py-1 text-sm",
                            ticket.status === "resolved" && "bg-green-600/20 text-green-400",
                            ticket.status === "escalated" && "bg-red-600/20 text-red-400"
                          )}
                        >
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Badge>
                      </div>

                      <h3 className="text-xl font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {ticket.subject || "Untitled Ticket"}
                      </h3>

                      <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                        {ticket.description || "No description available"}
                      </p>

                      <p className="text-slate-400 text-sm">
                        Created: {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                    <CardFooter className="p-6 pt-0">
                      <Link to={`/support/${ticket.id}`} className="w-full">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2">
                          <Eye className="h-4 w-4" /> View Thread
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {hasNextPage && (
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                  {isFetchingNextPage ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Loading more tickets...
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      className="border-slate-600 hover:bg-slate-800"
                    >
                      Load More
                    </Button>
                  )}
                </div>
              )}

              {!hasNextPage && processedTickets.length > 0 && (
                <p className="text-center text-slate-500 py-8">End of your tickets</p>
              )}
            </>
          )}
        </div>

        {/* Ticket Creation Modal */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-5 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-4">
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription className="text-sm">
                Please provide as much detail as possible so we can assist you quickly.
            </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
            {/* Subject */}
            <div className="space-y-1.5">
                <Label htmlFor="subject" className="required text-sm">
                Subject <span className="text-red-400 text-xs">*</span>
                </Label>
                <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Issue with recent booking payment"
                className="bg-slate-800 text-white border-slate-700 focus:ring-blue-500 h-9 text-sm"
                disabled={createTicket.isPending}
                maxLength={100}
                />
                <p className="text-xs text-slate-500 text-right">
                {subject.length} / 100
                </p>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-sm">Priority</Label>
                <Select
                value={priority}
                onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}
                disabled={createTicket.isPending}
                >
                <SelectTrigger className="bg-slate-800 text-white border-slate-700 h-9 text-sm">
                    <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white text-sm">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                </SelectContent>
                </Select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
                <Label htmlFor="category" className="text-sm">Category</Label>
                <Select
                value={category}
                onValueChange={setCategory}
                disabled={createTicket.isPending}
                >
                <SelectTrigger className="bg-slate-800 text-white border-slate-700 h-9 text-sm">
                    <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white text-sm">
                    <SelectItem value="booking">Booking Issue</SelectItem>
                    <SelectItem value="payment">Payment Problem</SelectItem>
                    <SelectItem value="technical">Technical / Bug</SelectItem>
                    <SelectItem value="account">Account / Profile</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                </SelectContent>
                </Select>
            </div>

            {/* Related Booking/Order ID */}
            <div className="space-y-1.5">
                <Label htmlFor="related_id" className="text-sm">Related Booking / Order ID (optional)</Label>
                <Input
                id="related_id"
                value={relatedId}
                onChange={(e) => setRelatedId(e.target.value)}
                placeholder="e.g. BK-123456 or ORD-789"
                className="bg-slate-800 text-white border-slate-700 h-9 text-sm"
                disabled={createTicket.isPending}
                />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
                <Label htmlFor="description" className="required text-sm">
                Description <span className="text-red-400 text-xs">*</span>
                </Label>
                <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe your problem in detail... Include dates, amounts, usernames, error messages, etc."
                className="min-h-[140px] bg-slate-800 text-white border-slate-700 resize-none focus:ring-blue-500 text-sm"
                disabled={createTicket.isPending}
                maxLength={2000}
                />
                <p className="text-xs text-slate-500 text-right">
                {description.length} / 2000
                </p>
            </div>

            {/* Attachments note */}
            <div className="text-xs text-slate-400 italic pt-1">
                Note: File attachments (screenshots, receipts) can be added after ticket creation in the thread view.
            </div>
            </div>

            <DialogFooter className="gap-3 pt-2">
            <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createTicket.isPending}
                className="h-9 text-sm"
            >
                Cancel
            </Button>
            <Button
                onClick={handleCreate}
                disabled={
                createTicket.isPending ||
                !subject.trim() ||
                description.trim().length < 20
                }
                className="bg-blue-600 hover:bg-blue-700 min-w-[140px] h-9 text-sm"
            >
                {createTicket.isPending ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                </>
                ) : (
                "Submit Ticket"
                )}
            </Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>
      </div>
  );
}