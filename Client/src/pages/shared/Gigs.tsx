/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/shared/Gigs.tsx
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Star, RefreshCw, Search as SearchIcon, X } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_id: string;
  seller_name: string;
  rating: number;
  review_count: number;
  available: boolean;
  image_url?: string;
  created_at: string;
};

const PAGE_SIZE = 9;

const fetchGigs = async ({ pageParam = 0 }: { pageParam?: number }) => {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: rawData, error, count } = await supabase
    .from("gigs")
    .select(
      `
      id, title, description, price, category, created_at, image_url, available,
      profiles!gigs_seller_id_fkey (full_name, rating, review_count)
    `,
      { count: "exact" }
    )
    .eq("status", "published")
    .range(from, to)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
    throw error;
  }

  // Flatten nested profiles object
  const data = rawData?.map((gig: any) => ({
    ...gig,
    seller_name: gig.profiles?.full_name || "Unknown Seller",   // ← added
    rating: gig.profiles?.rating || 0,
    review_count: gig.profiles?.review_count || 0,
  })) || [];

  return {
    gigs: data as Gig[],
    nextPage: data.length === PAGE_SIZE ? pageParam + 1 : null,
    totalCount: count ?? 0,
  };
};

export default function Gigs() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["gigs"],
    queryFn: fetchGigs,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000,
  });

  const allGigs = useMemo(() => data?.pages.flatMap(p => p.gigs) ?? [], [data]);

  // ────────────────────────────────────────────────
  // Search, Filter & Sort State
  // ────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<"newest" | "price-low" | "price-high" | "rating-high">("newest");
  const [availabilityOnly, setAvailabilityOnly] = useState(false);

  const categories = useMemo(() => {
    return Array.from(new Set(allGigs.map(gig => gig.category)));
  }, [allGigs]);

  // ────────────────────────────────────────────────
  // Filtered & Sorted Gigs
  // ────────────────────────────────────────────────
  const processedGigs = useMemo(() => {
    let result = [...allGigs];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        gig =>
          gig.title.toLowerCase().includes(term) ||
          gig.description.toLowerCase().includes(term) ||
          gig.seller_name?.toLowerCase().includes(term)   // ← added seller name to search
      );
    }

    if (selectedCategory) {
      result = result.filter(gig => gig.category === selectedCategory);
    }

    if (availabilityOnly) {
      result = result.filter(gig => gig.available);
    }

    switch (sortOption) {
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "rating-high":
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      default: // newest
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [allGigs, searchTerm, selectedCategory, sortOption, availabilityOnly]);

  // ────────────────────────────────────────────────
  // Native Infinite Scroll
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

  // ────────────────────────────────────────────────
  // Real-time updates
  // ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("public:gigs-published")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gigs",
          filter: "status=eq.published",
        },
        (payload) => {
          if (payload.eventType === "INSERT") toast.success("New gig published!");
          else if (payload.eventType === "UPDATE") toast.info("A gig was updated");
          else if (payload.eventType === "DELETE") toast.info("A gig was removed");

          queryClient.invalidateQueries({ queryKey: ["gigs"] });
        }
      )
      .subscribe();

    return () => {
      // fire-and-forget removal so cleanup does not return a Promise
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load gigs</p>
        <p className="text-slate-400 mb-6">{error.message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  // Determine dynamic no results message
  const noResultsMessage = () => {
    if (searchTerm && !selectedCategory && !availabilityOnly) {
      return `No gigs match your search for "${searchTerm}"`;
    }
    if (!searchTerm && selectedCategory && !availabilityOnly) {
      return `No gigs found in category "${selectedCategory.replace(/_/g, " ")}"`;
    }
    if (!searchTerm && !selectedCategory && availabilityOnly) {
      return "No available gigs at the moment";
    }
    if (searchTerm && selectedCategory && !availabilityOnly) {
      return `No gigs found for "${searchTerm}" in "${selectedCategory.replace(/_/g, " ")}"`;
    }
    if (searchTerm && !selectedCategory && availabilityOnly) {
      return `No available gigs match your search for "${searchTerm}"`;
    }
    if (!searchTerm && selectedCategory && availabilityOnly) {
      return `No available gigs in category "${selectedCategory.replace(/_/g, " ")}"`;
    }
    if (searchTerm && selectedCategory && availabilityOnly) {
      return `No available gigs match "${searchTerm}" in "${selectedCategory.replace(/_/g, " ")}"`;
    }
    return "No gigs found";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-6">Available Gigs</h1>

        {/* Controls */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search gigs, sellers, or descriptions..."
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
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating-high">Highest Rated</SelectItem>
              </SelectContent>
            </Select>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedCategory === null ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-3 py-1 text-sm",
                    selectedCategory === null && "bg-blue-600 hover:bg-blue-700"
                  )}
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Badge>

                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer px-3 py-1 text-sm capitalize",
                      selectedCategory === cat && "bg-blue-600 hover:bg-blue-700"
                    )}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}

            <Badge
              variant={availabilityOnly ? "default" : "outline"}
              className="cursor-pointer px-3 py-1 text-sm"
              onClick={() => setAvailabilityOnly(!availabilityOnly)}
            >
              Available Only
            </Badge>

            {(searchTerm || selectedCategory || availabilityOnly) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory(null);
                  setSortOption("newest");
                  setAvailabilityOnly(false);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading && allGigs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <Skeleton key={i} height={340} className="rounded-xl" />
            ))}
          </div>
        ) : processedGigs.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">{noResultsMessage()}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processedGigs.map(gig => (
                <Card
                  key={gig.id}
                  className="bg-slate-900/70 border-slate-700 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-950/30 transition-all duration-300 overflow-hidden group"
                >
                  <div className="relative">
                    <img
                      src={gig.image_url || "/placeholder-gig.jpg"}
                      alt={gig.title}
                      className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <CardContent className="p-6">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 capitalize">
                        {gig.category.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                      {gig.title}
                    </h3>
                    <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                      {gig.description}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-slate-300">
                          {gig.rating.toFixed(1)} ({gig.review_count})
                        </span>
                      </div>
                      <span className="text-emerald-400 font-medium">
                        R{gig.price.toFixed(2)} / hr
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      by {gig.seller_name || "Seller"} {gig.available ? "(Available)" : "(Unavailable)"}
                    </p>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Link to={`/gig/${gig.id}`} className="w-full">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 transition-colors">
                        View & Book
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
                    Loading more gigs...
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

            {!hasNextPage && processedGigs.length > 0 && (
              <p className="text-center text-slate-500 py-8">End of results</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}