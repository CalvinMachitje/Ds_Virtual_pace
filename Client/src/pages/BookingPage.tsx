import { ArrowLeft, Calendar, Clock, Star, Edit2, Shield, CreditCard } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const BookingPage = () => {
  const { sellerId } = useParams();

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <Link to={`/seller/${sellerId || '1'}`} className="p-2 -ml-2">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </Link>
        <h1 className="font-semibold text-foreground">Review Booking</h1>
        <div className="w-10" />
      </header>

      {/* Seller Card */}
      <section className="px-4 py-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage 
                  src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop" 
                  alt="David M." 
                />
                <AvatarFallback>DM</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[hsl(var(--success))] rounded-full border-2 border-card" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">David M.</h2>
                  <p className="text-sm text-muted-foreground">Expert Administrative Support</p>
                </div>
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
                  <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="text-xs font-semibold text-foreground">4.9</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                  Email Management
                </span>
                <span className="text-sm text-muted-foreground">R250.00/hr</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Details */}
      <section className="px-4 py-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Booking Details</h3>
        
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Calendar className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Date & Time</p>
                <p className="text-sm text-muted-foreground">Tue, Oct 24 • 10:00 AM - 12:00 PM</p>
              </div>
            </div>
            <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
              <Edit2 className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Clock className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Duration</p>
              <p className="text-sm text-muted-foreground">2 hours</p>
            </div>
          </div>
        </div>
      </section>

      {/* Price Breakdown */}
      <section className="px-4 py-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Price Breakdown</h3>
        
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-muted-foreground">
            <span>Rate (2 hrs × R250.00)</span>
            <span>R500.00</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Service Fee</span>
            <span>R5.00</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taxes</span>
            <span>R0.00</span>
          </div>
          <div className="border-t border-border pt-3 mt-3">
            <div className="flex justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-xl font-bold text-primary">R550.00</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Method */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Payment Method</h3>
          <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]">
            <Shield className="h-4 w-4" />
            Secure
          </span>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 bg-secondary rounded flex items-center justify-center text-xs font-mono text-muted-foreground">
                VISA
              </div>
              <div>
                <p className="font-medium text-foreground">Visa ending in 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/26</p>
              </div>
            </div>
            <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            </div>
          </div>

          <button className="w-full text-left text-primary text-sm font-medium hover:underline">
            + Add new payment method
          </button>
        </div>
      </section>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="max-w-lg mx-auto space-y-3">
          <p className="text-xs text-muted-foreground text-center">
            Free cancellation up to 24h before
          </p>
          <Button size="lg" className="w-full text-lg gap-2">
            <CreditCard className="h-5 w-5" />
            Confirm and Pay
            <span className="ml-1 px-2 py-0.5 bg-primary-foreground/20 rounded text-sm">R550.00</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
