/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/seller/EditGig.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Skeleton from "react-loading-skeleton";

const gigSchema = z.object({
  title: z.string().min(8, "Title must be at least 8 characters").max(80),
  category: z.enum([
    "admin_support",
    "call_handling",
    "email_management",
    "scheduling",
    "data_entry",
    "customer_support",
    "social_media",
    "web_research",
    "other",
  ]),
  description: z.string().min(120, "Description must be at least 120 characters").max(5000),
  price: z.number().min(50, "Price must be at least R50").max(2000),
  image_url: z.array(z.string().url()).max(5, "Maximum 5 images allowed").optional(),
});

type GigForm = z.infer<typeof gigSchema>;

type ExistingGig = GigForm & {
  id: string;
  seller_id: string;
  status: string;
};

export default function EditGig() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing gig
  const { data: gig, isLoading: isGigLoading } = useQuery<ExistingGig>({
    queryKey: ["gig", id],
    queryFn: async () => {
      if (!id) throw new Error("No gig ID");

      const { data, error } = await supabase
        .from("gigs")
        .select("*")
        .eq("id", id)
        .eq("seller_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Gig not found or you don't own it");

      return data;
    },
    enabled: !!id && !!user?.id,
  });

  const form = useForm<GigForm>({
    resolver: zodResolver(gigSchema),
    defaultValues: {
      title: "",
      category: "admin_support",
      description: "",
      price: 250,
      image_url: [],
    },
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = form;

  // Reset form when gig data is loaded
  useEffect(() => {
    if (gig) {
      reset({
        title: gig.title,
        category: gig.category,
        description: gig.description,
        price: gig.price,
        image_url: gig.image_url || [],
      });
      setPreviews(gig.image_url || []);
    }
  }, [gig, reset]);

  const updateGig = useMutation({
    mutationFn: async (data: GigForm) => {
      if (!user || !id) throw new Error("Not authenticated or no gig ID");

      const { error } = await supabase
        .from("gigs")
        .update({
          title: data.title,
          description: data.description,
          price: data.price,
          category: data.category,
          image_url: data.image_url || [],
        })
        .eq("id", id)
        .eq("seller_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gig", id] });
      queryClient.invalidateQueries({ queryKey: ["seller-gigs", user?.id] });
      toast.success("Gig updated successfully!");
      navigate("/gigs");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update gig");
    },
  });

  const onSubmit = (data: GigForm) => {
    updateGig.mutate(data);
  };

  const galleryUrls = watch("image_url") || [];

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;

    const validFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024
    );

    if (galleryUrls.length + validFiles.length > 5) {
      toast.error(`Maximum 5 images allowed (currently ${galleryUrls.length})`);
      return;
    }

    const tempIds = validFiles.map((f) => `${f.name}-${Date.now()}`);
    setUploadingFiles((prev) => [...prev, ...tempIds]);

    const newUrls: string[] = [];
    const newPreviewsList: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const tempId = tempIds[i];

      try {
        const preview = URL.createObjectURL(file);
        newPreviewsList.push(preview);

        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}.${ext}`;
        const filePath = `${user.id}/gigs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("gig-gallery")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("gig-gallery")
          .getPublicUrl(filePath);

        if (urlData.publicUrl) newUrls.push(urlData.publicUrl);

        setUploadProgress((prev) => ({ ...prev, [tempId]: 100 }));
      } catch (err: any) {
        toast.error(`Upload failed for ${file.name}`);
      }
    }

    setValue("image_url", [...galleryUrls, ...newUrls], { shouldValidate: true });
    setPreviews((prev) => [...prev, ...newPreviewsList]);
    setUploadingFiles((prev) => prev.filter((id) => !tempIds.includes(id)));
  };

  const removeImage = (index: number) => {
    const updated = galleryUrls.filter((_, i) => i !== index);
    setValue("image_url", updated);
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  if (isGigLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-4xl mx-auto space-y-8">
          <Skeleton height={400} />
          <Skeleton height={200} count={3} />
        </div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p className="text-xl mb-4">Gig not found or you don't own it</p>
        <Button onClick={() => navigate("/gigs")}>Back to Gigs</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 pb-24 md:ml-64">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Edit Gig</h1>
        </div>

        <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Update Gig Details</CardTitle>
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
                {errors.title && <p className="text-red-400 text-sm">{errors.title.message}</p>}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-slate-200">
                  Category <span className="text-red-400">*</span>
                </Label>
                <Select
                  onValueChange={(val) => form.setValue("category", val as any)}
                  defaultValue={gig.category}
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
                {errors.category && <p className="text-red-400 text-sm">{errors.category.message}</p>}
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
                {errors.description && <p className="text-red-400 text-sm">{errors.description.message}</p>}
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
                {errors.price && <p className="text-red-400 text-sm">{errors.price.message}</p>}
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
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(e.dataTransfer.files);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:border-blue-500"
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

                {errors.image_url && (
                  <p className="text-red-400 text-sm">{errors.image_url.message}</p>
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
                  disabled={updateGig.isPending || uploadingFiles.length > 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-6 text-lg font-medium"
                >
                  {updateGig.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : uploadingFiles.length > 0 ? (
                    "Uploading images..."
                  ) : (
                    "Update Gig"
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