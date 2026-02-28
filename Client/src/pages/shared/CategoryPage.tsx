// src/pages/shared/CategoryPage.tsx
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import {
  ArrowLeft,
  Star,
  MessageCircle,
  Heart,
  CheckCircle,
  MessageSquare,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Send,
  Loader2,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import debounce from "lodash/debounce";
import NavLayout from "@/components/layout/NavLayout";

const PAGE_SIZE = 9;

type SellerGroup = {
  seller: {
    id: string;
    full_name: string;
    avatar_url?: string;
    rating?: number;
    is_verified?: boolean;
    is_online?: boolean;
  };
  gigs: {
    id: string;
    title: string;
    description: string;
    price: number;
  }[];
  reviewCount: number;
};

export default function CategoryPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const decodedCategory = decodeURIComponent(slug || "");

  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("ai");
  const [page, setPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Request modal state
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDesc, setRequestDesc] = useState("");
  const [requestBudget, setRequestBudget] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Debounce search
  const debouncedSearch = debounce((value: string) => {
    setSearch(value);
    setPage(1);
  }, 500);

  const { data, isLoading, error, refetch } = useQuery<{
    sellers: SellerGroup[];
    total: number;
    page: number;
    has_more: boolean;
    message?: string;
  }>({
    queryKey: ["category", decodedCategory, page, minRating, maxPrice, search, sort],
    queryFn: async () => {
      let url = `/api/buyer/categories/${encodeURIComponent(decodedCategory)}?page=${page}&limit=${PAGE_SIZE}`;

      if (minRating > 0) url += `&min_rating=${minRating}`;
      if (maxPrice) url += `&max_price=${maxPrice}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (sort !== "ai") url += `&sort=${sort}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || `Failed to load ${decodedCategory} sellers (${res.status})`);
      }

      return responseData;
    },
    enabled: !!decodedCategory,
  });

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);
  const sellers = data?.sellers || [];
  const emptyMessage = data?.message || `No sellers found in "${decodedCategory}"`;

  const toggleSave = async (sellerId: string) => {
    if (!user) {
      toast.error("Please log in to save sellers");
      navigate("/login");
      return;
    }

    try {
      const checkRes = await fetch(`/api/buyer/saved/${sellerId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });

      const isSaved = checkRes.ok && (await checkRes.json()).saved;

      if (isSaved) {
        await fetch(`/api/buyer/saved/${sellerId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        });
        toast.success("Removed from saved sellers");
      } else {
        await fetch("/api/buyer/saved", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
          body: JSON.stringify({ seller_id: sellerId }),
        });
        toast.success("Seller saved");
      }
    } catch (err) {
      toast.error("Failed to update saved status");
    }
  };

  const messageSeller = (sellerId: string) => {
    toast.warning("Direct messaging is disabled until your request is confirmed by admin and accepted by a seller.");
  };

  const openRequestModal = (sellerId?: string) => {
    if (!user) {
      toast.error("Please log in to send a request");
      navigate("/login");
      return;
    }

    setSelectedSellerId(sellerId || null);
    setRequestTitle(`Request for ${decodedCategory} service`);
    setRequestDesc("");
    setRequestBudget("");
    setStartDate(undefined);
    setDueDate(undefined);
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    if (!requestTitle.trim() || !requestDesc.trim()) {
      toast.error("Title and description are required");
      return;
    }

    if (!startDate) {
      toast.error("Preferred start date is required");
      return;
    }

    if (dueDate && isBefore(dueDate, startDate)) {
      toast.error("Estimated due date must be after preferred start date");
      return;
    }

    setSubmittingRequest(true);

    try {
      const payload = {
        category: decodedCategory,
        title: requestTitle.trim(),
        description: requestDesc.trim(),
        budget: requestBudget ? Number(requestBudget) : null,
        preferred_start_time: startDate ? startDate.toISOString() : null,
        estimated_due_time: dueDate ? dueDate.toISOString() : null,
        seller_id: selectedSellerId, // optional: pre-assign specific seller
      };

      const res = await fetch("/api/buyer/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit request");
      }

      toast.success("Request submitted successfully! Admin will review and assign a seller.");
      setRequestOpen(false);

    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const resetFilters = () => {
    setMinRating(0);
    setMaxPrice(null);
    setSearch("");
    setSort("ai");
    setPage(1);
  };

  if (error) {
    const isNotFound = error.message.includes("404");
    return (
      <NavLayout>
        <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
          <AlertCircle className="h-16 w-16 mb-6" />
          <h2 className="text-2xl font-bold mb-4">
            {isNotFound ? `Category "${decodedCategory}" not found` : "Failed to load sellers"}
          </h2>
          <p className="text-slate-400 mb-6 text-center max-w-md">
            {isNotFound
              ? "This category may not exist yet or has no active sellers."
              : error.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/categories")}
              className="border-slate-600 hover:bg-slate-800"
            >
              Browse All Categories
            </Button>
          </div>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <h1 className="text-3xl md:text-4xl font-bold text-white capitalize">
                {decodedCategory.replace(/_/g, " ")} Services
              </h1>
            </div>

            <div className="text-slate-400 text-sm md:text-base">
              {data ? `${data.total} sellers found` : ""}
            </div>
          </div>

          {/* Mobile Filter Toggle */}
          <div className="lg:hidden mb-6">
            <Button
              variant="outline"
              className="w-full border-slate-700 text-white hover:bg-slate-800"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showMobileFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar */}
            <div
              className={`w-full lg:w-72 lg:sticky lg:top-6 lg:h-fit ${
                showMobileFilters ? "block" : "hidden lg:block"
              }`}
            >
              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-semibold">Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>

                  {/* Search */}
                  <div className="mb-6">
                    <Label className="text-slate-200 mb-2 block">Search Seller</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="e.g. John Doe"
                        value={search}
                        onChange={(e) => debouncedSearch(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  {/* Min Rating */}
                  <div className="mb-6">
                    <Label className="text-slate-200 mb-2 block">Min Rating</Label>
                    <Input
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      value={minRating}
                      onChange={(e) => {
                        setMinRating(Number(e.target.value) || 0);
                        setPage(1);
                      }}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  {/* Max Price */}
                  <div className="mb-6">
                    <Label className="text-slate-200 mb-2 block">Max Price per Hour</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={maxPrice ?? ""}
                      onChange={(e) => {
                        setMaxPrice(e.target.value ? Number(e.target.value) : null);
                        setPage(1);
                      }}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  {/* Sort */}
                  <div className="mb-6">
                    <Label className="text-slate-200 mb-2 block">Sort By</Label>
                    <select
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        setPage(1);
                      }}
                      className="w-full bg-slate-800 border-slate-700 text-white rounded-md p-2"
                    >
                      <option value="ai">AI Recommended</option>
                      <option value="rating-high">Highest Rating</option>
                      <option value="price-low">Lowest Price</option>
                      <option value="price-high">Highest Price</option>
                      <option value="newest">Newest</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-80 rounded-xl" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-16 text-red-400 bg-slate-900/40 rounded-xl border border-slate-800">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-xl font-medium mb-2">
                    {error.message.includes("404")
                      ? `Category "${decodedCategory}" not found`
                      : "Failed to load sellers"}
                  </p>
                  <p className="text-slate-400 mb-6">
                    {error.message.includes("404")
                      ? "This category may not exist yet or has no active gigs."
                      : error.message}
                  </p>
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
                      Try Again
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/categories")}
                      className="border-slate-600 hover:bg-slate-800"
                    >
                      Browse All Categories
                    </Button>
                  </div>
                </div>
              ) : sellers.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-medium mb-2">
                    No sellers found in "{decodedCategory}"
                  </p>
                  <p className="mb-6">
                    {data?.message || "This category may not have any active sellers yet."}
                  </p>
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Button onClick={resetFilters} variant="outline">
                      Reset Filters
                    </Button>
                    <Button
                      onClick={() => navigate("/categories")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Browse All Categories
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sellers.map((s, index) => (
                    <motion.div
                      key={s.seller.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <Card className="bg-slate-900/80 border-slate-700 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/20">
                        <CardContent className="p-6">
                          {/* Seller Header */}
                          <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-14 w-14 border-2 border-slate-700">
                                <AvatarImage src={s.seller.avatar_url} alt={s.seller.full_name} />
                                <AvatarFallback className="bg-slate-800 text-white">
                                  {s.seller.full_name?.[0] || "?"}
                                </AvatarFallback>
                              </Avatar>

                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-semibold text-white">
                                    {s.seller.full_name}
                                  </h3>
                                  {s.seller.is_verified && (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center text-yellow-400">
                                    <Star className="h-4 w-4 fill-yellow-400" />
                                    <span className="ml-1 text-sm">
                                      {s.seller.rating?.toFixed(1) || "New"}
                                    </span>
                                  </div>
                                  <span className="text-slate-500 text-xs">
                                    ({s.reviewCount} reviews)
                                  </span>
                                </div>

                                {s.seller.is_online && (
                                  <Badge className="mt-2 bg-green-600/30 text-green-400 border-green-500/50">
                                    Online now
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleSave(s.seller.id)}
                                className="text-pink-400 hover:text-pink-300 hover:bg-pink-950/30"
                              >
                                <Heart className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>

                          {/* Gigs */}
                          <div className="space-y-4">
                            {s.gigs.slice(0, 3).map((gig) => (
                              <Link
                                key={gig.id}
                                to={`/gig/${gig.id}`}
                                className="block"
                              >
                                <div className="bg-slate-800/70 p-4 rounded-lg hover:bg-slate-700 transition">
                                  <h4 className="font-medium text-white line-clamp-2 mb-2">
                                    {gig.title}
                                  </h4>
                                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                                    {gig.description}
                                  </p>
                                  <div className="text-emerald-400 font-semibold">
                                    R{gig.price.toLocaleString()} / hr
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            <Button
                              variant="outline"
                              className="flex-1 border-blue-600 text-blue-400 hover:bg-blue-950/30"
                              onClick={() => openRequestModal(s.seller.id)}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Request this Seller
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => messageSeller(s.seller.id)}
                              className="text-slate-400 hover:text-slate-300"
                            >
                              <MessageCircle className="h-5 w-5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleSave(s.seller.id)}
                              className="text-pink-400 hover:text-pink-300"
                            >
                              <Heart className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-12">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="border-slate-700 text-white hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <span className="text-slate-300 px-4 py-2">
                    Page {page} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="border-slate-700 text-white hover:bg-slate-800"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Request Modal */}
        <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Request {decodedCategory} Service
                {selectedSellerId && " from this seller"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <Label className="text-slate-200 mb-2 block">Title</Label>
                <Input
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  placeholder="e.g., Need logo design for new brand"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div>
                <Label className="text-slate-200 mb-2 block">Description</Label>
                <Textarea
                  value={requestDesc}
                  onChange={(e) => setRequestDesc(e.target.value)}
                  placeholder="Describe what you need, any specific requirements, etc."
                  className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-200 mb-2 block">Budget (R) - optional</Label>
                  <Input
                    type="number"
                    value={requestBudget}
                    onChange={(e) => setRequestBudget(e.target.value)}
                    placeholder="e.g., 500"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-6">
                {/* Preferred Start Date + Time */}
                <div>
                  <Label className="text-slate-200 mb-2 block">Preferred Start Date & Time *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white",
                          !startDate && "text-slate-400"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP p") : <span>Pick start date & time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date) {
                            const newDate = new Date(date);
                            newDate.setHours(startDate?.getHours() || 9, startDate?.getMinutes() || 0);
                            setStartDate(newDate);
                          }
                        }}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                      {startDate && (
                        <div className="p-3 border-t border-slate-700">
                          <Label className="text-slate-200 mb-2 block text-sm">Time</Label>
                          <Input
                            type="time"
                            value={format(startDate, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":").map(Number);
                              const newDate = new Date(startDate);
                              newDate.setHours(hours, minutes);
                              setStartDate(newDate);
                            }}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Estimated Due Date & Time */}
                <div>
                  <Label className="text-slate-200 mb-2 block">Estimated Due Date & Time (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white",
                          !dueDate && "text-slate-400"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP p") : <span>Pick due date & time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={(date) => {
                          if (date) {
                            const newDate = new Date(date);
                            newDate.setHours(dueDate?.getHours() || 17, dueDate?.getMinutes() || 0);
                            setDueDate(newDate);
                          }
                        }}
                        initialFocus
                        disabled={(date) => startDate ? isBefore(date, startDate) : isBefore(date, new Date())}
                      />
                      {dueDate && (
                        <div className="p-3 border-t border-slate-700">
                          <Label className="text-slate-200 mb-2 block text-sm">Time</Label>
                          <Input
                            type="time"
                            value={format(dueDate, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":").map(Number);
                              const newDate = new Date(dueDate);
                              newDate.setHours(hours, minutes);
                              setDueDate(newDate);
                            }}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <p className="text-sm text-slate-400">
                Your request will be reviewed by admin. A suitable seller will be assigned.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRequestOpen(false)}
                className="border-slate-600 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={submitRequest}
                disabled={
                  submittingRequest ||
                  !requestTitle.trim() ||
                  !requestDesc.trim() ||
                  !startDate
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submittingRequest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </NavLayout>
  );
}