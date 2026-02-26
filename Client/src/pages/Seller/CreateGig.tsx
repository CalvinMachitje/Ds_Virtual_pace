/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/seller/CreateGig.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// ── Schema ────────────────────────────────────────────────
const gigSchema = z.object({
  title: z.string().min(8, "Title must be at least 8 characters").max(80),
  category: z.enum([
    "admin_support", "call_handling", "email_management", "scheduling", "data_entry",
    "customer_support", "social_media", "web_research", "other",
    "Graphics & Design", "Programming & Tech", "Video & Animation",
    "Writing & Translation", "Digital Marketing", "Music & Audio",
    "Photography", "Business"
  ]),
  description: z.string().min(120, "Description must be at least 120 characters").max(5000),
  price: z.number().min(50, "Price must be at least R50").max(2000),
  gallery_urls: z.array(z.string().url()).max(5, "Maximum 5 images allowed").optional(),
});

type GigForm = z.infer<typeof gigSchema>;

export default function CreateGig() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Block unverified sellers
  useEffect(() => {
    if (userRole !== "seller" || !user?.id) return;

    const checkVerification = async () => {
      try {
        const res = await fetch("/api/profile/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Verification check failed");
        }

        const profile = await res.json();
        if (!profile.is_verified) {
          toast.error("You must be verified before creating gigs. Please wait for admin approval.");
          navigate("/seller-profile");
        }
      } catch (err: any) {
        toast.error("Could not verify your account status");
        navigate("/seller-profile");
      }
    };

    checkVerification();
  }, [userRole, user?.id, navigate]);

  const form = useForm<GigForm>({
    resolver: zodResolver(gigSchema),
    defaultValues: {
      title: "",
      category: "admin_support",
      description: "",
      price: 250,
      gallery_urls: [],
    },
    mode: "onChange",
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue } = form;

  const galleryUrls = watch("gallery_urls") || [];
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const createGig = useMutation({
    mutationFn: async (data: GigForm) => {
      if (!user) throw new Error("Not authenticated");

      const res = await fetch("/api/seller/gigs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create gig");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gigs"] });
      toast.success("Gig created and published!");
      navigate("/my-gigs");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create gig");
    },
  });

  const onSubmit = (data: GigForm) => {
    createGig.mutate(data);
  };

  const titleLength = watch("title")?.length || 0;
  const descLength = watch("description")?.length || 0;

  // ── Gallery handling ────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024
    );

    if (galleryUrls.length + validFiles.length > 5) {
      toast.error(`Maximum 5 images allowed (currently ${galleryUrls.length})`);
      return;
    }

    const formData = new FormData();
    validFiles.forEach(file => formData.append("images", file));

    const tempIds = validFiles.map(f => f.name);
    setUploadingFiles(tempIds);

    try {
      const res = await fetch("/api/seller/gig-images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Image upload failed");
      }

      const { urls } = await res.json();

      // Generate local previews
      const newPreviews = validFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);

      // Update form field with returned URLs
      setValue("gallery_urls", [...galleryUrls, ...urls], { shouldValidate: true });

      toast.success(`${urls.length} image(s) uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload images");
    } finally {
      setUploadingFiles([]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeImage = (index: number) => {
    const updated = galleryUrls.filter((_, i) => i !== index);
    setValue("gallery_urls", updated);
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Create a New Gig</h1>
        </div>

        <p className="text-slate-400 mb-10">List your virtual assistant service and start earning</p>

        <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Gig Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-200">
                  Gig Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. I will manage your inbox and calendar like a pro"
                  {...register("title")}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  {errors.title ? (
                    <p className="text-red-400">{errors.title.message}</p>
                  ) : (
                    <span>{titleLength}/80</span>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-slate-200">
                  Category <span className="text-red-400">*</span>
                </Label>
                <Select
                  onValueChange={(val) => form.setValue("category", val as any)}
                  defaultValue="admin_support"
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin_support">Admin Support</SelectItem>
                    <SelectItem value="call_handling">Call Handling</SelectItem>
                    <SelectItem value="email_management">Email Management</SelectItem>
                    <SelectItem value="scheduling">Scheduling</SelectItem>
                    <SelectItem value="data_entry">Data Entry</SelectItem>
                    <SelectItem value="customer_support">Customer Support</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="web_research">Web Research</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-red-400 text-sm">{errors.category.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-200">
                  Description <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your services, experience, what clients can expect..."
                  {...register("description")}
                  className="min-h-[180px] bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  {errors.description ? (
                    <p className="text-red-400">{errors.description.message}</p>
                  ) : (
                    <span>{descLength}/5000</span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-slate-200">
                  Starting Price (Rand) <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                  <Input
                    id="price"
                    type="number"
                    min="50"
                    {...register("price", { valueAsNumber: true })}
                    className="pl-8 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                {errors.price && (
                  <p className="text-red-400 text-sm">{errors.price.message}</p>
                )}
              </div>

              {/* Gallery */}
              <div className="space-y-4">
                <Label className="text-slate-200">Gallery Images (up to 5, max 5MB each)</Label>

                {previews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {previews.map((src, index) => (
                      <div key={index} className="relative group rounded-md overflow-hidden border border-slate-600">
                        <img src={src} alt={`preview-${index}`} className="w-full h-32 object-cover" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                    uploadingFiles.length > 0 ? "border-blue-500 bg-blue-950/30" : "border-slate-600 hover:border-slate-400"
                  )}
                >
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                    id="gallery-upload"
                  />
                  <Label htmlFor="gallery-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                    <p className="text-slate-300">
                      Drag & drop images or <span className="underline">click to browse</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">PNG, JPG — max 5MB per image</p>
                  </Label>
                </div>

                {uploadingFiles.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {uploadingFiles.map((name) => (
                      <div key={name} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Uploading {name}...</span>
                          <span>{uploadProgress[name] ?? 0}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${uploadProgress[name] ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {errors.gallery_urls && (
                  <p className="text-red-400 text-sm">{errors.gallery_urls.message}</p>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1 border-slate-600 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createGig.isPending || uploadingFiles.length > 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-6 text-lg font-medium"
                >
                  {createGig.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Publishing Gig...
                    </>
                  ) : uploadingFiles.length > 0 ? (
                    "Uploading images..."
                  ) : (
                    "Publish Gig"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}