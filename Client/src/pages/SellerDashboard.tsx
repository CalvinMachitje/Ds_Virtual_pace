// src/pages/SellerDashboard.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SellerDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Welcome back, Calvin</h1>
        <p className="text-slate-400 mb-8">Manage your services & bookings</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-blue-400 mb-2">12</div>
              <p className="text-slate-300">Active Bookings</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-green-400 mb-2">4.9</div>
              <p className="text-slate-300">Current Rating</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-yellow-400 mb-2">$1,240</div>
              <p className="text-slate-300">This Month</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions for seller */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-indigo-950 to-blue-950 border-indigo-800">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">Create New Gig</h3>
              <p className="text-slate-300 mb-6">List a new service offering</p>
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                Create Gig
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">My Availability</h3>
              <p className="text-slate-300 mb-6">Update when you're available</p>
              <Button variant="outline" size="lg" className="border-slate-600 hover:bg-slate-800">
                Manage Calendar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}