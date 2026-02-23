// src/pages/shared/VerificationStatus.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldCheck, CheckCircle2, Star, Clock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "sonner";

type Verification = {
  trust_score: number;
  jobs_done: number;
  rating: number;
  credentials: {
    title: string;
    desc: string;
    detail?: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
};

export default function VerificationStatus() {
  const { id } = useParams<{ id: string }>();

  const { data: verification, isLoading, error, refetch } = useQuery<Verification>({
    queryKey: ["verification", id],
    queryFn: async () => {
      if (!id) throw new Error("No profile ID");

      const res = await fetch(`/api/profiles/${id}/verification`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification not found");
      }

      return res.json();
    },
    enabled: !!id,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <p className="text-xl mb-4">Failed to load verification</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6 md:ml-64">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Verification Status</h1>
        <p className="text-slate-400 mb-8">Trust Score & Credentials</p>

        {isLoading ? (
          <div className="space-y-8">
            <div className="text-center">
              <Skeleton circle width={128} height={128} className="mx-auto mb-6" />
              <Skeleton width="60%" height={32} className="mx-auto mb-2" />
              <Skeleton width="40%" height={24} className="mx-auto" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton height={80} count={3} />
            </div>
            <Skeleton height={40} className="mb-4" />
            <Skeleton height={100} count={4} className="mb-4" />
          </div>
        ) : !verification ? (
          <div className="text-center py-20 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">No verification data</p>
            <p className="mt-2">This profile has no verification information available.</p>
          </div>
        ) : (
          <>
            {/* Main card */}
            <Card className="bg-slate-900/80 border-slate-700 backdrop-blur-md mb-8">
              <CardContent className="p-6 md:p-8 text-center">
                <div className="relative inline-block mb-6">
                  <Avatar className="h-32 w-32 border-4 border-green-600 mx-auto">
                    <AvatarImage src="/avatars/sarah.jpg" alt="Sarah" />
                    <AvatarFallback>SJ</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-3 -right-3 bg-green-600 p-2 rounded-full border-4 border-slate-950">
                    <ShieldCheck className="h-8 w-8 text-white" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold text-white mb-2">Sarah Jenkins</h2>
                <Badge className="bg-green-700 hover:bg-green-700 text-lg px-4 py-1 mb-4">
                  Fully Verified Assistant • PRO
                </Badge>

                <div className="grid grid-cols-3 gap-4 my-8">
                  <div>
                    <p className="text-4xl font-bold text-green-400">{verification.trust_score}%</p>
                    <p className="text-slate-400 mt-1">Trust Score</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-white">{verification.jobs_done}+</p>
                    <p className="text-slate-400 mt-1">Jobs Done</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-yellow-400">{verification.rating}</p>
                    <p className="text-slate-400 mt-1">Rating</p>
                  </div>
                </div>

                <p className="text-slate-300 mb-6">Member since 2021 • Verifications renewed annually</p>
              </CardContent>
            </Card>

            {/* Credentials */}
            <h3 className="text-2xl font-semibold text-white mb-4">Verified Credentials</h3>
            <div className="space-y-4">
              {verification.credentials.map((item, i) => (
                <Card key={i} className="bg-slate-900/60 border-slate-800 backdrop-blur-sm">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="mt-1">
                      <item.icon className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{item.title}</h4>
                      <p className="text-slate-300">{item.desc}</p>
                      {item.detail && <p className="text-slate-500 text-sm mt-1">{item.detail}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button className="w-full mt-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-7 text-lg">
              Hire Now →
            </Button>
          </>
        )}
      </div>
    </div>
  );
}