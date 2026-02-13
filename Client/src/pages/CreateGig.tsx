// src/pages/CreateGig.tsx (New file: Form for sellers to create a gig)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const gigSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  price: z.number().min(5, "Price must be at least $5"),
  category: z.string().min(3, "Category is required"),
});

type GigForm = z.infer<typeof gigSchema>;

export default function CreateGig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<GigForm>({
    resolver: zodResolver(gigSchema),
  });

  const createGig = useMutation({
    mutationFn: async (data: GigForm) => {
      const { error } = await supabase
        .from("gigs")
        .insert({
          seller_id: user?.id,
          title: data.title,
          description: data.description,
          price: data.price,
          category: data.category,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gigs"] });
      navigate("/dashboard");
    },
  });

  const onSubmit = (data: GigForm) => {
    createGig.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Create New Gig</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Gig Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="title" className="text-slate-200">Title</Label>
                <Input id="title" {...register("title")} className="mt-2" />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="description" className="text-slate-200">Description</Label>
                <Textarea id="description" {...register("description")} className="mt-2 min-h-[150px]" />
                {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>}
              </div>

              <div>
                <Label htmlFor="price" className="text-slate-200">Price per Hour ($)</Label>
                <Input id="price" type="number" {...register("price", { valueAsNumber: true })} className="mt-2" />
                {errors.price && <p className="text-red-400 text-sm mt-1">{errors.price.message}</p>}
              </div>

              <div>
                <Label htmlFor="category" className="text-slate-200">Category</Label>
                <Input id="category" {...register("category")} className="mt-2" />
                {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={createGig.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
              >
                {createGig.isPending ? "Creating..." : "Create Gig"}
              </Button>
              {createGig.error && (
                <p className="text-red-400 text-center">{(createGig.error as Error).message}</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}