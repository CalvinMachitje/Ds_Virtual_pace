// src/pages/WorkerProfile.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageSquare, Bookmark, ShieldCheck } from "lucide-react";

export default function WorkerProfile() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
          <div className="relative">
            <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-blue-600">
              <AvatarImage src="/avatars/sarah.jpg" alt="Sarah Jenkins" />
              <AvatarFallback>SJ</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-green-600 p-1.5 rounded-full border-2 border-slate-900">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <h1 className="text-3xl font-bold text-white">Sarah Jenkins</h1>
              <Badge className="bg-blue-600 hover:bg-blue-600">VERIFIED PRO</Badge>
            </div>
            <p className="text-xl text-slate-300 mt-1">Executive Virtual Assistant</p>
            <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
              <div className="flex">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              </div>
              <span className="text-slate-300">4.9 (124 reviews)</span>
            </div>
            <p className="text-slate-400 mt-1">Member since 2021</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700 py-6 text-lg">
            <MessageSquare className="mr-2 h-5 w-5" /> Message
          </Button>
          <Button variant="outline" className="flex-1 border-slate-600 hover:bg-slate-800 py-6 text-lg">
            <Bookmark className="mr-2 h-5 w-5" /> Save
          </Button>
        </div>

        {/* About */}
        <Card className="bg-slate-900/70 border-slate-700 mb-6 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">About Me</h2>
            <p className="text-slate-300 leading-relaxed">
              I am a highly organized Executive Virtual Assistant with over 5 years of experience managing complex calendars, travel arrangements, and inbox zero strategies for C-suite executives. I thrive in fast-paced environments and pride myself on my proactive problem-solving skills.
            </p>
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="bg-slate-900/70 border-slate-700 mb-6 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Services Offered</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {["Email Management", "Calendar Scheduling", "Travel Arrangements"].map((service) => (
                <div
                  key={service}
                  className="bg-slate-800/60 p-4 rounded-lg text-center border border-slate-700"
                >
                  <p className="font-medium text-slate-200">{service}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Client Reviews</h2>
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  </div>
                  <span className="text-slate-300">Mark T. • 2 days ago</span>
                </div>
                <p className="text-slate-300">
                  Sarah organized my entire inbox in two days! She is incredibly efficient and easy to communicate with. Highly recommend for any busy professional.
                </p>
              </div>

              {/* More reviews... */}
            </div>
            <Button variant="ghost" className="mt-4 text-blue-400 hover:text-blue-300">
              View all 124 reviews →
            </Button>
          </CardContent>
        </Card>

        {/* Book button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 to-transparent md:static md:mt-8 md:p-0">
          <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-7 text-lg">
            Book Now • Starting at $30/hr
          </Button>
        </div>
      </div>
    </div>
  );
}