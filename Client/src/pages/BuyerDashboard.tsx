// src/pages/BuyerDashboard.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function BuyerDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Welcome back, Calvin</h1>
        <p className="text-slate-400 mb-8">What do you need help with today?</p>

        {/* Search bar */}
        <div className="relative mb-10">
          <Input
            placeholder="Search for virtual assistants, tasks, categories..."
            className="pl-12 py-7 text-lg bg-slate-900/60 border-slate-700"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
        </div>

        {/* Featured categories / trending */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Trending Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Email Management", "Calendar Support", "Call Handling", "Data Entry"].map((cat) => (
              <Card key={cat} className="bg-slate-900/70 border-slate-700 hover:border-blue-600 transition-colors">
                <CardContent className="p-6 text-center">
                  <h3 className="font-medium text-white">{cat}</h3>
                  <p className="text-sm text-slate-400 mt-1">120+ pros</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-950 to-indigo-950 border-blue-800">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">Instant Match</h3>
              <p className="text-slate-300 mb-6">Get matched with a VA in under 5 minutes</p>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Try Instant Match
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">My Bookings</h3>
              <p className="text-slate-300 mb-6">View and manage your active & completed bookings</p>
              <Button variant="outline" size="lg" className="border-slate-600 hover:bg-slate-800">
                Go to Bookings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}