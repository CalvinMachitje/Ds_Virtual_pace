/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Buyer/BuyerProfile.tsx
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  MoreVertical,
  MessageSquare,
  Bookmark,
  Star,
  CheckCircle,
  Edit,
  Upload,
  X,
  Plus,
  Save,
  Clock,
  DollarSign,
  List,
  CreditCard,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Profile = {
  id: string;
  full_name?: string | null;
  role: "buyer" | "seller";
  bio?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  is_verified?: boolean;
  interests?: string[];
};

type BookingSummary = {
  id: string;
  gig_title?: string;
  seller_name?: string;
  status: string;
  price: number;
  date: string;
};

const INTEREST_SUGGESTIONS = [
  "Virtual Assistance",
  "Content Writing",
  "Graphic Design",
  "Social Media Management",
  "Video Editing",
  "Web Development",
  "Translation",
  "Data Entry",
  "Customer Support",
  "Admin Tasks",
  "Creative Work",
  "Marketing Help",
];

export default function BuyerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentBookings, setRecentBookings] = useState<BookingSummary[]>([]);
  const [stats, setStats] = useState({
    totalSpent: 0,
    bookingsCompleted: 0,
    activeBookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interests edit state
  const [openInterestPopover, setOpenInterestPopover] = useState(false);
  const [interestInput, setInterestInput] = useState("");

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) {
      setError("No profile ID provided");
      setLoading(false);
      return;
    }

    const fetchProfileAndData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch profile
        const profileRes = await fetch(`/api/buyer/profile/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (!profileRes.ok) {
          const errData = await profileRes.json().catch(() => ({}));
          throw new Error(errData.error || "Profile not found");
        }

        const profileData = await profileRes.json();
        setProfile(profileData);

        if (isOwnProfile) {
          setEditForm({
            full_name: profileData.full_name || "",
            bio: profileData.bio || "",
            phone: profileData.phone || "",
            interests: profileData.interests || [],
          });
        }

        // 2. Fetch recent bookings (limit 5)
        const bookingsRes = await fetch(`/api/buyer/profile/${id}/bookings?limit=5`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          const formattedBookings = (bookingsData || []).map((b: any) => ({
            id: b.id,
            gig_title: b.gig?.title || "Untitled Gig",
            seller_name: b.seller?.full_name || "Unknown Seller",
            status: b.status || "unknown",
            price: b.price || 0,
            date: b.created_at ? new Date(b.created_at).toLocaleDateString("en-ZA") : "—",
          }));

          setRecentBookings(formattedBookings);

          // Calculate stats
          const totalSpent = formattedBookings.reduce((sum, b) => sum + b.price, 0);
          const completed = formattedBookings.filter(b => b.status === "completed").length;
          const active = formattedBookings.filter(b => !["completed", "cancelled"].includes(b.status)).length;

          setStats({ totalSpent, bookingsCompleted: completed, activeBookings: active });
        } else {
          console.warn("Bookings fetch failed, continuing without");
        }
      } catch (err: any) {
        console.error("Profile fetch error:", err);
        setError(err.message || "Failed to load profile");
        toast.error("Could not load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndData();
  }, [id, isOwnProfile]);

  const handleEditToggle = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditForm({});
    } else {
      setIsEditing(true);
      setEditForm({
        full_name: profile?.full_name || "",
        bio: profile?.bio || "",
        phone: profile?.phone || "",
        interests: profile?.interests || [],
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      setUploadingAvatar(true);

      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/buyer/profile/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const { publicUrl } = await res.json();

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast.success("Avatar updated successfully!");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to upload avatar: " + err.message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addInterest = (interest: string) => {
    if (!interest.trim()) return;
    const current = editForm.interests || [];
    if (!current.includes(interest.trim())) {
      setEditForm(prev => ({ ...prev, interests: [...current, interest.trim()] }));
    }
    setInterestInput("");
    setOpenInterestPopover(false);
  };

  const removeInterest = (interest: string) => {
    setEditForm(prev => ({
      ...prev,
      interests: (prev.interests || []).filter(i => i !== interest),
    }));
  };

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return;

    try {
      const res = await fetch(`/api/buyer/profile/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({
          full_name: editForm.full_name?.trim(),
          bio: editForm.bio?.trim(),
          phone: editForm.phone?.trim(),
          interests: editForm.interests || [],
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Update failed");
      }

      const updatedProfile = await res.json();

      setProfile(prev => ({
        ...prev!,
        ...updatedProfile,
      }));

      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      console.error("Profile update error:", err);
      toast.error("Failed to update profile: " + err.message);
    }
  };

  const handleMessage = () => {
    if (!profile?.id) return;
    navigate(`/chat/${profile.id}`);
  };

  const handleBook = () => {
    if (!profile?.id) return;
    navigate(`/gigs?with=${profile.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex flex-col items-center">
            <Skeleton className="h-32 w-32 rounded-full mb-4" />
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="flex gap-4 w-full max-w-xs">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-3xl font-bold text-white mb-4">Profile Not Found</h2>
        <p className="text-slate-300 mb-8 max-w-md">{error || "This profile doesn't exist or is not public."}</p>
        <Button onClick={() => navigate(-1)} className="bg-blue-600 hover:bg-blue-700">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              if (isOwnProfile) {
                navigate("/dashboard");
              } else {
                navigate(-1);
              }
            }}
            className="p-2 -ml-2"
            aria-label={isOwnProfile ? "Go to dashboard" : "Go back"}
          >
            <ArrowLeft className="h-6 w-6 text-white" />
          </button>

          <h1 className="text-xl font-semibold text-white">
            {isOwnProfile ? "My Profile" : `${profile.full_name || "Buyer"}'s Profile`}
          </h1>

          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <Button variant="ghost" size="icon" onClick={handleEditToggle}>
                {isEditing ? <X className="h-5 w-5 text-white" /> : <Edit className="h-5 w-5 text-white" />}
              </Button>
            )}
            <button className="p-2 -mr-2">
              <MoreVertical className="h-6 w-6 text-white" />
            </button>
          </div>
        </header>

        {/* Profile Header */}
        <section className="flex flex-col items-center mb-10">
          <div className="relative mb-6 group">
            <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-slate-700 ring-2 ring-blue-500/20">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
              <AvatarFallback className="bg-slate-800 text-2xl font-bold">
                {profile.full_name?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>

            {isOwnProfile && (
              <>
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                >
                  <Upload className="h-8 w-8 text-white" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
              </>
            )}

            {profile.is_verified && (
              <div className="absolute -bottom-2 -right-2 bg-green-600 p-1.5 rounded-full border-2 border-slate-900">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="w-full max-w-md space-y-6 mb-8">
              <div>
                <Label htmlFor="edit-fullName">Full Name</Label>
                <Input
                  id="edit-fullName"
                  name="full_name"
                  value={editForm.full_name || ""}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  name="phone"
                  value={editForm.phone || ""}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="edit-bio">Bio</Label>
                <Textarea
                  id="edit-bio"
                  name="bio"
                  value={editForm.bio || ""}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                  placeholder="Tell others about yourself..."
                />
              </div>

              {/* Interests multi-select + custom add */}
              <div>
                <Label>My Interests & Preferences</Label>
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  {(editForm.interests || []).map((interest) => (
                    <Badge
                      key={interest}
                      variant="secondary"
                      className="bg-slate-700 text-white px-3 py-1 flex items-center gap-1"
                    >
                      {interest}
                      <button
                        onClick={() => removeInterest(interest)}
                        className="ml-1 text-slate-300 hover:text-white"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>

                <Popover open={openInterestPopover} onOpenChange={setOpenInterestPopover}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between bg-slate-800 border-slate-700 text-white">
                      Add interest...
                      <Plus className="h-4 w-4 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 bg-slate-900 border-slate-700">
                    <Command>
                      <CommandInput
                        placeholder="Search or type new interest..."
                        value={interestInput}
                        onValueChange={setInterestInput}
                        className="bg-slate-800 text-white border-0 focus:ring-0"
                      />
                      <CommandList>
                        <CommandGroup heading="Suggestions">
                          {INTEREST_SUGGESTIONS.filter(i =>
                            i.toLowerCase().includes(interestInput.toLowerCase()) &&
                            !(editForm.interests || []).includes(i)
                          ).map((interest) => (
                            <CommandItem
                              key={interest}
                              onSelect={() => addInterest(interest)}
                              className="cursor-pointer hover:bg-slate-800"
                            >
                              {interest}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        {interestInput.trim() && !INTEREST_SUGGESTIONS.includes(interestInput.trim()) && (
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => addInterest(interestInput.trim())}
                              className="cursor-pointer hover:bg-slate-800"
                            >
                              Add custom: "{interestInput.trim()}"
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleSaveProfile} className="flex-1 bg-green-600 hover:bg-green-700">
                  Save Changes
                </Button>
                <Button onClick={handleEditToggle} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-4xl font-bold text-white mb-2">{profile.full_name || "Buyer"}</h2>
              <p className="text-xl text-slate-300 capitalize mb-4">{profile.role}</p>

              <div className="flex flex-wrap gap-4 justify-center">
                {!isOwnProfile && (
                  <>
                    <Button 
                      onClick={handleMessage}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg gap-2"
                    >
                      <MessageSquare className="h-5 w-5" />
                      Message
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleBook}
                      className="border-slate-600 hover:bg-slate-800 px-8 py-6 text-lg gap-2"
                    >
                      <Bookmark className="h-5 w-5" />
                      Book Now
                    </Button>
                  </>
                )}

                {isOwnProfile && (
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 px-8 py-6 text-lg gap-2"
                    onClick={handleEditToggle}
                  >
                    <Edit className="h-5 w-5" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </>
          )}
        </section>

        {/* Bio */}
        <Card className="bg-slate-900/70 border-slate-700 mb-8 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">About Me</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
              {profile.bio || "This user hasn't added a bio yet."}
            </p>
          </CardContent>
        </Card>

        {/* Interests */}
        <Card className="bg-slate-900/70 border-slate-700 mb-8 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">My Interests & Preferences</h2>
            {profile.interests && profile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {profile.interests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="secondary"
                    className="bg-slate-800 text-slate-200 px-4 py-2 text-base"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-400 py-8 italic">
                {isOwnProfile 
                  ? "You haven't added any interests yet. Let sellers know what kind of help you're looking for!"
                  : "This buyer hasn't shared any interests yet."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="bg-slate-900/70 border-slate-700 mb-8 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Recent Bookings</h2>
            {recentBookings.length > 0 ? (
              <div className="space-y-4">
                {recentBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div>
                      <p className="font-medium text-white">{b.gig_title}</p>
                      <p className="text-sm text-slate-400">with {b.seller_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={b.status === "completed" ? "default" : "secondary"}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </Badge>
                      <p className="text-sm text-emerald-400 mt-1">R{b.price.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{b.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-400 py-8 italic">
                {isOwnProfile 
                  ? "No recent bookings yet. Start exploring gigs!"
                  : "This buyer has no recent bookings visible."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">My Activity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 p-6 rounded-xl text-center border border-slate-700">
                <CreditCard className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                <p className="text-3xl font-bold text-white">R{stats.totalSpent.toFixed(2)}</p>
                <p className="text-sm text-slate-400 mt-1">Total Spent</p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl text-center border border-slate-700">
                <List className="h-10 w-10 mx-auto mb-3 text-blue-400" />
                <p className="text-3xl font-bold text-white">{stats.bookingsCompleted}</p>
                <p className="text-sm text-slate-400 mt-1">Completed Bookings</p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl text-center border border-slate-700">
                <Clock className="h-10 w-10 mx-auto mb-3 text-purple-400" />
                <p className="text-3xl font-bold text-white">{stats.activeBookings}</p>
                <p className="text-sm text-slate-400 mt-1">Active Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}