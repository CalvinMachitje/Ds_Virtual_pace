// src/pages/ReviewBooking.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, DollarSign, CreditCard, ShieldCheck } from "lucide-react";

export default function ReviewBooking() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Review Booking</h1>
        <p className="text-slate-400 mb-8">Please confirm the details before payment</p>

        {/* Worker summary */}
        <Card className="bg-slate-900/80 border-slate-700 backdrop-blur-md mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="/avatars/david.jpg" alt="David" />
                <AvatarFallback>DM</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-white text-xl">David M.</h3>
                <p className="text-slate-300">Expert Administrative Support</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-blue-600">Email Management</Badge>
                  <span className="text-slate-400">• $25.00/hr</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="font-bold text-white">4.9</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking details */}
        <Card className="bg-slate-900/70 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-white">Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Date & Time</p>
                    <p className="text-white">Tue, Oct 24 • 10:00 AM - 12:00 PM</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Duration</p>
                    <p className="text-white">2 hours</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Rate</p>
                    <p className="text-white">$25.00/hr × 2 hrs = $50.00</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-slate-400 text-sm">Service Fee + Taxes</p>
                    <p className="text-white">$5.00 (incl.)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6 mt-6">
              <div className="flex justify-between items-center text-lg">
                <span className="text-white font-semibold">Total</span>
                <span className="text-2xl font-bold text-green-400">$55.00</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment method */}
        <Card className="bg-slate-900/70 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-white">Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-lg border border-slate-600">
              <CreditCard className="h-8 w-8 text-blue-400" />
              <div>
                <p className="font-medium text-white">Visa ending in 4242</p>
                <p className="text-slate-400 text-sm">Expires 12/26</p>
              </div>
              <Button variant="ghost" className="ml-auto text-blue-400">
                Change
              </Button>
            </div>

            <p className="text-sm text-slate-400 mt-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Secure payment • Free cancellation up to 24h before
            </p>
          </CardContent>
        </Card>

        {/* Confirm button */}
        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-8 text-xl">
          Confirm and Pay $55.00
        </Button>
      </div>
    </div>
  );
}