/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
// src/pages/seller/MyGigs.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Loader2,
  Briefcase,
  Link,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_id: string;
  created_at: string;
  status: "draft" | "published" | "archived";
  image_url?: string;
};

const PAGE_SIZE = 12;

const fetchMyGigs = async (sellerId: string, { pageParam = 0 }) => {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("gigs")
    .select(
      `
      id, title, description, price, category, seller_id, created_at, status, image_url
    `,
      { count: "exact" }
    )
    .eq("seller_id", sellerId)
    .range(from, to)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return {
    gigs: data || [],
    nextPage: data?.length === PAGE_SIZE ? pageParam + 1 : null,
    totalCount: count ?? 0,
  };
};

export default function MyGigs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!user) {
    return <div>Please log in to view your gigs.</div>;
  }

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["my-gigs", user.id],
    queryFn: ({ pageParam }) => fetchMyGigs(user.id, { pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000,
  });

  const allGigs = useMemo(() => data?.pages.flatMap((p) => p.gigs) ?? [], [data]);

  // Bulk delete
  const [selectedGigIds, setSelectedGigIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSelectGig = (gigId: string, checked: boolean) => {
    setSelectedGigIds((prev) =>
      checked ? [...prev, gigId] : prev.filter((id) => id !== gigId)
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedGigIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("gigs")
        .delete()
        .in("id", selectedGigIds)
        .eq("seller_id", user.id);

      if (error) throw error;

      toast.success(`${selectedGigIds.length} gig(s) deleted`);
      setSelectedGigIds([]);
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["my-gigs", user.id] });
    } catch (err: any) {
      toast.error("Failed to delete gigs: " + err.message);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p className="text-xl mb-4">Failed to load your gigs</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ["my-gigs", user.id] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">My Gigs</h1>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate("/create-gig")}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add New Gig
            </Button>

            {selectedGigIds.length > 0 && (
              <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedGigIds.length})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete {selectedGigIds.length} gig(s)?</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. All selected gigs will be permanently removed.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteSelected}>
                      Delete Permanently
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isLoading && allGigs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={380} className="rounded-xl" />
            ))}
          </div>
        ) : allGigs.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">You haven't created any gigs yet</p>
            <p className="mt-2">Click "Add New Gig" to get started.</p>
            <Button
              onClick={() => navigate("/create-gig")}
              className="mt-6 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Gig
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allGigs.map((gig) => (
                <Card
                  key={gig.id}
                  className="bg-slate-900/70 border-slate-700 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-950/30 transition-all duration-300 overflow-hidden group relative"
                >
                  <div className="absolute top-3 left-3 z-10">
                    <Checkbox
                      checked={selectedGigIds.includes(gig.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedGigIds((prev) => [...prev, gig.id]);
                        } else {
                          setSelectedGigIds((prev) => prev.filter((id) => id !== gig.id));
                        }
                      }}
                      className="border-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </div>

                  <div className="relative">
                    <img
                      src={gig.image_url || "/placeholder-gig.jpg"}
                      alt={gig.title}
                      className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  <CardContent className="p-6">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 capitalize">
                        {gig.category.replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-3 py-1",
                          gig.status === "published" ? "text-green-400 border-green-600" :
                          gig.status === "draft" ? "text-yellow-400 border-yellow-600" :
                          "text-red-400 border-red-600"
                        )}
                      >
                        {gig.status.charAt(0).toUpperCase() + gig.status.slice(1)}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-semibold text-white mb-2 line-clamp-2">
                      {gig.title}
                    </h3>

                    <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                      {gig.description}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-emerald-400 font-medium">
                        R{gig.price.toFixed(2)} / hr
                      </span>
                      <span className="text-slate-400 text-sm">
                        Created {new Date(gig.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-6 pt-0 flex gap-3">
                    <Link to={`/edit-gig/${gig.id}`}>
                      <Button variant="outline" size="icon" className="border-slate-600 hover:bg-slate-800">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {hasNextPage && (
              <div className="py-12 flex justify-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Loading more...
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    className="border-slate-600 hover:bg-slate-800 px-8"
                  >
                    Load More
                  </Button>
                )}
              </div>
            )}

            {!hasNextPage && allGigs.length > 0 && (
              <p className="text-center text-slate-500 py-12">You've reached the end</p>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedGigIds.length} gig(s)?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All selected gigs will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSelected}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}