// src/pages/Seller/SellerProfile.tsx
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, MoreVertical, MessageSquare, Bookmark, Star, CheckCircle, Mail, Calendar, Plane, Edit, Phone, Save, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  full_name: string;
  phone?: string;
  role: "buyer" | "seller";
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  email?: string;
  average_rating: number;
  review_count: number;
  is_verified?: boolean;
  portfolio_images?: string[];
};

type Review = {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer: {
    full_name: string;
    avatar_url?: string;
  };
};

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Portfolio carousel scroll ref
  const portfolioRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) {
      setError("No profile ID provided");
      setLoading(false);
      return;
    }

    const fetchProfileAndReviews = async () => {
      try {
        setLoading(true);
        setReviewsLoading(true);
        setError(null);

        // 1. Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(`
            id, full_name, phone, email, role, avatar_url, bio, 
            created_at, updated_at, average_rating, review_count, 
            is_verified, portfolio_images
          `)
          .eq("id", id)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error("Profile not found");

        setProfile(profileData);

        // Pre-fill edit form if own profile
        if (user?.id === id) {
          setEditFullName(profileData.full_name || "");
          setEditPhone(profileData.phone || "");
          setEditBio(profileData.bio || "");
          setEditAvatarUrl(profileData.avatar_url || "");
        }

        // 2. Fetch reviews written about this seller
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select(`
            id, rating, comment, created_at,
            reviewer:profiles!reviewer_id (full_name, avatar_url)
          `)
          .eq("reviewed_id", id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (reviewsError) {
          console.warn("Reviews fetch warning:", reviewsError);
        }

        const formattedReviews = (reviewsData || []).map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewer: r.reviewer?.[0] || { full_name: "Anonymous", avatar_url: undefined },
        }));

        setReviews(formattedReviews);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to load profile");
        toast.error("Could not load profile");
      } finally {
        setLoading(false);
        setReviewsLoading(false);
      }
    };

    fetchProfileAndReviews();
  }, [id, user?.id]);

  const scrollPortfolio = (direction: "left" | "right") => {
    if (!portfolioRef.current) return;
    const scrollAmount = portfolioRef.current.clientWidth * 0.8;
    const current = portfolioRef.current.scrollLeft;
    portfolioRef.current.scrollTo({
      left: direction === "left" ? current - scrollAmount : current + scrollAmount,
      behavior: "smooth",
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setEditAvatarUrl(previewUrl);
  };

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return;

    setSaving(true);

    try {
      let avatarUrlToSave = editAvatarUrl;

      if (selectedAvatarFile) {
        setUploadingAvatar(true);
        const fileExt = selectedAvatarFile.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedAvatarFile, {
            upsert: true,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrlToSave = urlData.publicUrl;
        setUploadingAvatar(false);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName.trim(),
          phone: editPhone.trim() || null,
          bio: editBio.trim() || null,
          avatar_url: avatarUrlToSave || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Profile updated successfully!");

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: editFullName.trim(),
              phone: editPhone.trim() || undefined,
              bio: editBio.trim() || undefined,
              avatar_url: avatarUrlToSave || undefined,
            }
          : null
      );

      setSelectedAvatarFile(null);
      setEditAvatarUrl(avatarUrlToSave);
      setShowEditModal(false);
    } catch (err: any) {
      toast.error("Failed to update profile: " + err.message);
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 py-4">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex flex-col items-center px-4 py-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-8 w-48 mt-4" />
          <Skeleton className="h-5 w-32 mt-2" />
          <div className="flex gap-3 mt-6 w-full max-w-xs">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-4">Profile Not Found</h2>
        <p className="text-muted-foreground mb-6">{error || "The requested profile could not be loaded."}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <button
          onClick={() => (isOwnProfile ? navigate("/dashboard") : navigate(-1))}
          className="p-2 -ml-2"
          aria-label="Go back"
        >
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="font-semibold text-foreground">
          {isOwnProfile ? "My Profile" : "Worker Profile"}
        </h1>
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)}>
              <Edit className="h-5 w-5" />
            </Button>
          )}
          <button className="p-2 -mr-2">
            <MoreVertical className="h-6 w-6 text-foreground" />
          </button>
        </div>
      </header>

      {/* Profile Section */}
      <section className="flex flex-col items-center px-4 py-6">
        <div className="relative">
          <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-card">
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            <AvatarFallback>{profile.full_name?.[0] || "?"}</AvatarFallback>
          </Avatar>
          {profile.role === "seller" && profile.is_verified && (
            <div className="absolute -bottom-2 -right-2 bg-blue-600 p-1.5 rounded-full border-4 border-background">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          )}
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-4 flex items-center gap-3">
          {profile.full_name}
          {profile.is_verified && (
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-base px-3 py-1">
              <CheckCircle className="h-4 w-4" /> Verified Seller
            </Badge>
          )}
        </h2>
        <p className="text-muted-foreground text-lg capitalize mt-1">{profile.role}</p>

        {/* Rating Display */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1">
            <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            <span className="text-2xl font-semibold">
              {profile.average_rating?.toFixed(1) || "0.0"}
            </span>
          </div>
          <span className="text-muted-foreground text-lg">
            ({profile.review_count || 0} {profile.review_count === 1 ? "review" : "reviews"})
          </span>
        </div>

        <div className="flex gap-4 mt-8 w-full max-w-md">
          {isOwnProfile && (
            <Button 
              className="flex-1 gap-2 text-lg py-6 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="h-5 w-5" />
              Edit Profile
            </Button>
          )}
        </div>
      </section>

      {/* About Section */}
      <section className="px-4 py-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">About Me</h3>
        <p className="text-muted-foreground leading-relaxed">
          {profile.bio || "No bio added yet. This user hasn't written an introduction."}
        </p>
      </section>

      {/* Portfolio Carousel */}
      <section className="px-4 py-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">Portfolio</h3>
        {profile.portfolio_images && profile.portfolio_images.length > 0 ? (
          <div className="relative">
            <div 
              ref={portfolioRef}
              className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {profile.portfolio_images.map((img, index) => (
                <div 
                  key={index}
                  className="flex-none w-64 md:w-80 aspect-video rounded-xl overflow-hidden border border-slate-700 hover:border-blue-600 transition-all snap-center group shadow-md"
                >
                  <img
                    src={img}
                    alt={`Portfolio ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>

            {/* Navigation arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => scrollPortfolio("left")}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => scrollPortfolio("right")}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700">
            <p className="text-slate-400 italic">No portfolio items added yet.</p>
            {isOwnProfile && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowEditModal(true)}
              >
                Add Portfolio Images
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Reviews Section */}
      <section className="px-4 py-6">
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center justify-between">
          Client Reviews
          <div className="flex items-center gap-2 text-lg">
            <div className="flex">
              {[1,2,3,4,5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "h-5 w-5",
                    s <= Math.round(profile.average_rating || 0)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-slate-600"
                  )}
                />
              ))}
            </div>
            <span className="font-medium">
              {profile.average_rating?.toFixed(1) || "0.0"}
            </span>
            <span className="text-muted-foreground">
              ({profile.review_count || 0})
            </span>
          </div>
        </h3>

        {reviewsLoading ? (
          <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-8">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-slate-800 pb-8 last:border-0 last:pb-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.reviewer.avatar_url} alt={review.reviewer.full_name} />
                      <AvatarFallback>{review.reviewer.full_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{review.reviewer.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(review.created_at).toLocaleDateString("en-ZA", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-600"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-slate-300 leading-relaxed">
                  {review.comment || "No comment provided."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700">
            <p className="text-slate-400 italic">No reviews yet.</p>
            <p className="text-slate-500 mt-2 text-sm">
              Be the first to leave a review after working with this seller.
            </p>
          </div>
        )}
      </section>

      {/* Contact Info */}
      <section className="px-4 py-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">Contact Info</h3>
        <div className="space-y-4 bg-card rounded-xl p-6 border border-border">
          {profile.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span className="text-foreground">{profile.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="text-foreground break-all">{profile.email}</span>
          </div>
        </div>
      </section>

      {/* Fixed Bottom CTA */}
      {!isOwnProfile && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div>
              <p className="text-xs text-muted-foreground">Starting at</p>
              <p className="text-2xl font-bold text-foreground">R250<span className="text-sm font-normal text-muted-foreground">/hr</span></p>
            </div>
            <Button size="lg" className="px-8">
              Book Now
            </Button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your profile information.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="min-h-[100px] bg-background"
                  placeholder="Tell others about yourself..."
                />
              </div>
              <div>
                <Label htmlFor="avatar">Profile Picture</Label>
                <div className="flex flex-col gap-2">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="bg-background"
                  />
                  {editAvatarUrl && (
                    <div className="mt-2">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={editAvatarUrl} alt="Preview" />
                        <AvatarFallback>Preview</AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Max 5MB. JPG, PNG, GIF.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={saving || uploadingAvatar}
                className="bg-primary hover:bg-primary/90"
              >
                {saving || uploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingAvatar ? "Uploading..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}