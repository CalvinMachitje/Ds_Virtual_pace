// src/pages/Profile.tsx (New file: Public profile view)
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageSquare, Bookmark } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string;
  role: string;
  bio: string;
  avatar_url?: string;
  rating: number;
  review_count: number;
};

const fetchProfile = async (username: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username) // Assume you add a username column
    .single();

  if (error) throw error;

  // Add rating logic similar to WorkerProfile
  return data as Profile;
};

export default function Profile() {
  const { username } = useParams<{ username: string }>();

  const { data: profile, isLoading, error, refetch } = useQuery<Profile>({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username || ""),
    enabled: !!username,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load profile</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <Skeleton height={400} />
        ) : !profile ? (
          <div className="text-center py-20 text-slate-400">
            Profile not found
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <Avatar className="h-32 w-32 mb-4">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback>{profile.full_name[0]}</AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold text-white">{profile.full_name}</h1>
              <p className="text-slate-300">{profile.role}</p>
              <div className="flex gap-2 mt-4">
                <Button><MessageSquare className="mr-2" /> Message</Button>
                <Button variant="outline"><Bookmark className="mr-2" /> Save</Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Bio</h2>
                <p className="text-slate-300">{profile.bio}</p>
              </CardContent>
            </Card>

            {/* Add gigs, reviews, etc. similar to WorkerProfile */}
          </>
        )}
      </div>
    </div>
  );
}