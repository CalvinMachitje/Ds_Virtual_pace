// src/pages/VerificationStatus.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldCheck, CheckCircle2, Star, Clock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerificationStatus() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Verification Status</h1>
        <p className="text-slate-400 mb-8">Trust Score & Credentials</p>

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
                <p className="text-4xl font-bold text-green-400">100%</p>
                <p className="text-slate-400 mt-1">Trust Score</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white">450+</p>
                <p className="text-slate-400 mt-1">Jobs Done</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-yellow-400">4.9</p>
                <p className="text-slate-400 mt-1">Rating</p>
              </div>
            </div>

            <p className="text-slate-300 mb-6">Member since 2021 • Verifications renewed annually</p>
          </CardContent>
        </Card>

        {/* Credentials */}
        <h3 className="text-2xl font-semibold text-white mb-4">Verified Credentials</h3>
        <div className="space-y-4">
          {[
            {
              title: "Identity Verified",
              desc: "Government ID check passed",
              detail: "Verified via Stripe Identity on Oct 12, 2023",
              icon: UserCheck,
            },
            {
              title: "Background Check",
              desc: "Criminal & employment history clear",
              icon: ShieldCheck,
            },
            {
              title: "Skills Assessment",
              desc: "Top 10% in Data Entry",
              icon: Star,
            },
            {
              title: "D's Certified",
              desc: "Email Management Training completed",
              icon: CheckCircle2,
            },
          ].map((item, i) => (
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
          Hire Sarah Now →
        </Button>
      </div>
    </div>
  );
}