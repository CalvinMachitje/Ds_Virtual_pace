/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Seller/SellerProfile.tsx
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, MoreVertical, MessageSquare, Bookmark, Star, CheckCircle, Mail, Calendar, Plane, Edit, Phone, Save, Loader2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="flex flex-col items-center">
            <Skeleton className="h-32 w-32 rounded-full mb-6" />
            <Skeleton className="h-10 w-64 mb-4" />
            <Skeleton className="h-6 w-48 mb-8" />
          </div>
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 md:ml-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
          <p className="text-slate-400 mb-6">{error || "The requested profile could not be loaded."}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold text-white">
            {isOwnProfile ? "My Profile" : "Seller Profile"}
          </h1>
        </div>

        <Card className="bg-slate-900/70 border-slate-700 mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-slate-700">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback className="text-4xl">
                    {profile.full_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                {profile.is_verified && (
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 p-1.5 rounded-full border-4 border-background">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-white">
                    {profile.full_name}
                  </h2>
                  {profile.is_verified && (
                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-base px-4 py-1">
                      Verified Seller
                    </Badge>
                  )}
                </div>

                <p className="text-slate-400 capitalize mb-4">{profile.role}</p>

                <div className="flex items-center justify-center md:justify-start gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-semibold text-white">
                      {profile.average_rating?.toFixed(1) || "0.0"}
                    </span>
                  </div>
                  <span className="text-slate-400">
                    ({profile.review_count || 0} reviews)
                  </span>
                </div>

                {isOwnProfile && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowEditModal(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About & Contact */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">About Me</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 leading-relaxed">
                {profile.bio || "No bio added yet."}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <span className="text-slate-300">{profile.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <span className="text-slate-300 break-all">{profile.email}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio */}
        <Card className="bg-slate-900/70 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.portfolio_images && profile.portfolio_images.length > 0 ? (
              <div className="relative">
                <div
                  ref={portfolioRef}
                  className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth"
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

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-70 hover:opacity-100"
                  onClick={() => scrollPortfolio("left")}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-70 hover:opacity-100"
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
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Client Reviews
              <div className="flex items-center gap-3">
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
                <span className="text-xl font-semibold">
                  {profile.average_rating?.toFixed(1) || "0.0"}
                </span>
                <span className="text-slate-400">
                  ({profile.review_count || 0})
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      {isOwnProfile && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your seller profile information.</DialogDescription>
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
                  placeholder="Tell buyers about yourself..."
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
                className="bg-blue-600 hover:bg-blue-700"
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