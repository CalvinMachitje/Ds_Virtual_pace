/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/seller/SellerProfile.tsx
import { useState, useEffect, useRef, ChangeEvent } from "react";
import {
  ArrowLeft,
  Edit,
  Phone,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Upload,
  X,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
  Mail,
  Star,
  MessageSquare,
} from "lucide-react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "buyer" | "seller";
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  email: string | null;
  average_rating: number;
  review_count: number;
  is_verified: boolean;
  portfolio_images: string[] | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    full_name: string;
    avatar_url: string | null;
  };
};

interface Verification {
  id: string;
  status: "pending" | "approved" | "rejected" | null;
  evidence_urls: string[];
  submitted_at: string;
  rejection_reason: string | null;
}

interface PendingFile {
  id: string;
  file: File;
  name: string;
  progress: number;
  previewUrl?: string;
  error?: string;
}

interface PendingPortfolioFile {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  progress: number;
  error?: string;
}

// ── Component ────────────────────────────────────────────────────────────

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal (only visible to owner)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Portfolio upload (only owner)
  const [pendingPortfolioFiles, setPendingPortfolioFiles] = useState<PendingPortfolioFile[]>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [portfolioUploadProgress, setPortfolioUploadProgress] = useState(0);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  // Verification upload (only owner)
  const [pendingVerificationFiles, setPendingVerificationFiles] = useState<PendingFile[]>([]);
  const [uploadingVerificationDocs, setUploadingVerificationDocs] = useState(false);
  const [verificationOverallProgress, setVerificationOverallProgress] = useState(0);
  const verificationInputRef = useRef<HTMLInputElement>(null);

  // Portfolio scroll ref
  const portfolioRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = user?.id === id;
  const isLoggedIn = !!user;
  const isBuyerViewingSeller = isLoggedIn && user?.role === "buyer" && profile?.role === "seller";

  // ── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) {
      setError("No profile ID provided");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setReviewsLoading(true);
        setVerificationLoading(true);
        setError(null);

        let profileData;

        // 1. Profile fetch logic
        if (isOwnProfile) {
          // Own profile → use seller-specific endpoint
          const profileRes = await fetch("/api/seller/profile", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
            },
          });

          if (!profileRes.ok) {
            const err = await profileRes.json().catch(() => ({}));
            throw new Error(err.error || "Failed to load your profile");
          }

          profileData = await profileRes.json();
        } else {
          // Viewing someone else's profile → use public endpoint (create later)
          const profileRes = await fetch(`/api/profile/${id}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
            },
          });

          if (!profileRes.ok) {
            const err = await profileRes.json().catch(() => ({}));
            throw new Error(err.error || "Profile not found");
          }

          profileData = await profileRes.json();
        }

        setProfile(profileData);

        if (isOwnProfile) {
          setEditFullName(profileData.full_name || "");
          setEditPhone(profileData.phone || "");
          setEditBio(profileData.bio || "");
          setEditAvatarUrl(profileData.avatar_url || "");
        }

        // 2. Reviews (public)
        const reviewsRes = await fetch(`/api/profile/${id}/reviews`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setReviews(
            reviewsData.map((r: any) => ({
              id: r.id,
              rating: r.rating,
              comment: r.comment,
              created_at: r.created_at,
              reviewer: r.reviewer || { full_name: "Anonymous", avatar_url: null },
            }))
          );
        }

        // 3. Verification (only own seller profile)
        if (profileData.role === "seller" && isOwnProfile) {
          const verRes = await fetch("/api/seller/verification", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
            },
          });

          if (verRes.ok) {
            const verData = await verRes.json();
            setVerification(verData);
          }
        }
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to load profile");
        toast.error("Could not load profile");
      } finally {
        setLoading(false);
        setReviewsLoading(false);
        setVerificationLoading(false);
      }
    };

    fetchData();
  }, [id, isOwnProfile]);

  // ── Portfolio Handlers (only owner) ─────────────────────────────────────

  const scrollPortfolio = (direction: "left" | "right") => {
    if (!portfolioRef.current) return;
    const scrollAmount = portfolioRef.current.clientWidth * 0.8;
    portfolioRef.current.scrollTo({
      left: direction === "left" ? portfolioRef.current.scrollLeft - scrollAmount : portfolioRef.current.scrollLeft + scrollAmount,
      behavior: "smooth",
    });
  };

  const handlePortfolioSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !isOwnProfile) return;

    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxFiles = 10;
    const remaining = maxFiles - (profile?.portfolio_images?.length || 0) - pendingPortfolioFiles.length;

    if (files.length > remaining) {
      toast.error(`You can upload up to ${remaining} more images (max ${maxFiles} total)`);
      return;
    }

    const newFiles: PendingPortfolioFile[] = files
      .map((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          return null;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 5MB limit`);
          return null;
        }

        return {
          id: `${file.name}-${Date.now()}`,
          file,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          progress: 0,
        };
      })
      .filter((f): f is PendingPortfolioFile => f !== null);

    setPendingPortfolioFiles((prev) => [...prev, ...newFiles]);
  };

  const removePendingPortfolioFile = (id: string) => {
    setPendingPortfolioFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const uploadPortfolioImages = async () => {
    if (pendingPortfolioFiles.length === 0 || !user?.id || !isOwnProfile) return;

    setUploadingPortfolio(true);
    let completed = 0;

    const formData = new FormData();
    pendingPortfolioFiles.forEach((item) => {
      formData.append("images", item.file);
    });

    try {
      const res = await fetch("/api/seller/portfolio-images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload portfolio images");
      }

      const { urls } = await res.json();

      // Update local profile state
      setProfile((prev) =>
        prev ? { ...prev, portfolio_images: [...(prev.portfolio_images ?? []), ...urls] } : null
      );

      toast.success("Portfolio images added successfully!");
      setPendingPortfolioFiles([]);
      setPortfolioUploadProgress(0);
    } catch (err: any) {
      toast.error(err.message || "Portfolio upload failed");
    } finally {
      setUploadingPortfolio(false);
      if (portfolioInputRef.current) portfolioInputRef.current.value = "";
    }
  };

  // ── Avatar & Profile Handlers (only owner) ──────────────────────────────

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedAvatarFile(file);
    setEditAvatarUrl(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!user?.id || !profile || !isOwnProfile) return;

    setSaving(true);

    try {
      let avatarUrlToSave = editAvatarUrl;

      if (selectedAvatarFile) {
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append("avatar", selectedAvatarFile);

        const avatarRes = await fetch("/api/seller/avatar", {  // ← updated endpoint
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
          body: formData,
        });

        if (!avatarRes.ok) throw new Error("Avatar upload failed");

        const { publicUrl } = await avatarRes.json();
        avatarUrlToSave = publicUrl;
        setUploadingAvatar(false);
      }

      const updateRes = await fetch("/api/seller/profile", {  // ← updated endpoint
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({
          full_name: editFullName.trim() || null,
          phone: editPhone.trim() || null,
          bio: editBio.trim() || null,
          avatar_url: avatarUrlToSave || null,
        }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");

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

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="flex flex-col items-center gap-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-10 w-64" />
          </div>
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
          <h2 className="text-2xl font-bold">Profile Not Found</h2>
          <p className="text-slate-400 max-w-md">{error || "The requested profile could not be loaded."}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-3xl font-bold text-white">
              {isOwnProfile ? "My Profile" : `${profile.full_name}'s Profile`}
            </h1>
          </div>

          {/* Message Button – shown to logged-in buyers viewing a seller */}
          {isLoggedIn && !isOwnProfile && profile.role === "seller" && (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link to={`/chat/${id}`}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send Message
              </Link>
            </Button>
          )}
        </div>

        {/* Profile Card */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              <div className="relative shrink-0">
                <Avatar className="h-32 w-32 border-4 border-slate-700">
                  <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
                  <AvatarFallback className="text-4xl bg-slate-800">
                    {profile.full_name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {profile.is_verified && (
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 p-1.5 rounded-full border-4 border-background">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-3">
                  <h2 className="text-3xl font-bold text-white">{profile.full_name}</h2>
                  {profile.is_verified && (
                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-base px-4 py-1">
                      Verified Seller
                    </Badge>
                  )}
                </div>

                <p className="text-slate-400 capitalize">{profile.role}</p>

                <div className="flex items-center justify-center md:justify-start gap-8">
                  <div className="flex items-center gap-2">
                    <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-semibold text-white">
                      {profile.average_rating?.toFixed(1) ?? "0.0"}
                    </span>
                  </div>
                  <span className="text-slate-400">
                    ({profile.review_count ?? 0} reviews)
                  </span>
                </div>

                {/* Edit button – only for owner */}
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

        {/* Portfolio Section – public */}
        <Card className="bg-slate-900/70 border-slate-700 mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Portfolio</CardTitle>
            {isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portfolioInputRef.current?.click()}
                disabled={uploadingPortfolio}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Images
              </Button>
            )}
            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={handlePortfolioSelect}
            />
          </CardHeader>
          <CardContent>
            {(profile.portfolio_images?.length || pendingPortfolioFiles.length) ? (
              <div className="space-y-6">
                {/* Already uploaded images – visible to everyone */}
                {profile.portfolio_images?.length ? (
                  <div className="relative">
                    <div
                      ref={portfolioRef}
                      className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth"
                    >
                      {profile.portfolio_images.map((img, index) => (
                        <div
                          key={index}
                          className="flex-none w-64 md:w-80 aspect-video rounded-xl overflow-hidden border border-slate-700 hover:border-blue-600 transition-all snap-center group shadow-lg relative"
                        >
                          <img
                            src={img}
                            alt={`Portfolio ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isOwnProfile && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              // TODO: Implement delete endpoint if needed
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {profile.portfolio_images.length > 3 && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-70 hover:opacity-100"
                          onClick={() => scrollPortfolio("left")}
                        >
                          <ChevronLeft className="h-8 w-8" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-70 hover:opacity-100"
                          onClick={() => scrollPortfolio("right")}
                        >
                          <ChevronRight className="h-8 w-8" />
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}

                {/* Pending uploads – only owner sees this */}
                {pendingPortfolioFiles.length > 0 && isOwnProfile && (
                  <div className="space-y-4">
                    <Label className="text-slate-200">
                      Selected Images ({pendingPortfolioFiles.length})
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {pendingPortfolioFiles.map((file) => (
                        <div
                          key={file.id}
                          className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-800/50"
                        >
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="h-40 w-full object-cover"
                          />
                          {file.error ? (
                            <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center">
                              <p className="text-red-200 text-xs text-center px-2">{file.error}</p>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <p className="text-white text-xs text-center px-2 truncate max-w-[90%]">
                                {file.name}
                              </p>
                              <Progress value={file.progress} className="w-4/5 h-1.5" />
                            </div>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePendingPortfolioFile(file.id)}
                            disabled={uploadingPortfolio}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {uploadingPortfolio && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Uploading portfolio images...</span>
                          <span>{portfolioUploadProgress}%</span>
                        </div>
                        <Progress value={portfolioUploadProgress} className="h-2" />
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        onClick={uploadPortfolioImages}
                        disabled={uploadingPortfolio}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {uploadingPortfolio ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          "Save Portfolio Images"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-slate-700 border-dashed">
                <ImageIcon className="mx-auto h-12 w-12 text-slate-500 mb-4" />
                <p className="text-slate-400 text-lg mb-2">No portfolio images yet</p>
                <p className="text-slate-500 text-sm mb-6">
                  Showcase your previous work to attract more clients
                </p>
                {isOwnProfile && (
                  <Button
                    variant="outline"
                    onClick={() => portfolioInputRef.current?.click()}
                    disabled={uploadingPortfolio}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add Portfolio Images
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* About & Contact – public, but phone/email only for owner or if messaging */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">About Me</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                {profile.bio || "No bio added yet."}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.phone && (isOwnProfile || isBuyerViewingSeller) && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <span className="text-slate-300">{profile.phone}</span>
                </div>
              )}
              {profile.email && isOwnProfile && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <span className="text-slate-300 break-all">{profile.email}</span>
                </div>
              )}
              {!isOwnProfile && isLoggedIn && profile.role === "seller" && (
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link to={`/chat/${id}`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reviews – public */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Client Reviews
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
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
                  <span className="text-xl font-semibold text-white">
                    {profile.average_rating?.toFixed(1) ?? "0.0"}
                  </span>
                </div>
                <span className="text-slate-400">({profile.review_count ?? 0})</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewsLoading ? (
              <div className="space-y-8">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-10">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-slate-800 pb-10 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={review.reviewer.avatar_url ?? undefined}
                            alt={review.reviewer.full_name}
                          />
                          <AvatarFallback className="bg-slate-700">
                            {review.reviewer.full_name?.[0] ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">{review.reviewer.full_name}</p>
                          <p className="text-sm text-slate-400">
                            {new Date(review.created_at).toLocaleDateString("en-ZA", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-5 w-5",
                              i < review.rating
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-slate-700"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-slate-200 leading-relaxed">
                      {review.comment || "No comment provided."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-slate-700">
                <p className="text-slate-400 italic text-lg">No reviews yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Dialog – only owner */}
      {isOwnProfile && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your personal information.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="min-h-32"
                  placeholder="Tell clients about your experience and services..."
                />
              </div>

              <div className="space-y-2">
                <Label>Profile Picture</Label>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={editAvatarUrl} />
                      <AvatarFallback>
                        {editFullName?.[0] ?? profile.full_name?.[0] ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Recommended: square image, max 5MB
                    </p>
                  </div>
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
                className="min-w-32"
              >
                {saving || uploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingAvatar ? "Uploading..." : "Saving..."}
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}