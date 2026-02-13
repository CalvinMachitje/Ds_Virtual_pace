import { ArrowLeft, Heart, Share2, Star, Shield, Lock, Headphones, CheckCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const categoryData: Record<string, { title: string; description: string; image: string }> = {
  "call-handling": {
    title: "Call Handling & Reception",
    description: "Never miss a lead again. Our verified assistants manage your inbound calls, schedule appointments, and filter spam with professional etiquette tailored to your brand voice.",
    image: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&h=600&fit=crop",
  },
  "admin-support": {
    title: "Admin Support",
    description: "Get professional administrative support for your daily tasks. Our verified assistants handle scheduling, documentation, and coordination with precision.",
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop",
  },
  "email-management": {
    title: "Email Management",
    description: "Achieve inbox zero with our email management experts. They organize, prioritize, and respond to your emails professionally.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop",
  },
};

const benefits = [
  { icon: Shield, title: "100% Verified Identity", description: "Every assistant passes a rigorous ID and background check." },
  { icon: Lock, title: "NDA Signed & Secure", description: "Your business data and client contacts are legally protected." },
  { icon: Headphones, title: "VoIP Experts", description: "Experienced with RingCentral, Aircall, and Zoom Phone." },
];

const topPros = [
  { id: "1", name: "Sarah J.", languages: "English, Spanish", rating: 4.9, image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop", verified: true },
  { id: "2", name: "David M.", languages: "English, French", rating: 5.0, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", verified: true },
  { id: "3", name: "Emily K.", languages: "English, German", rating: 4.8, image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", verified: true },
];

const CategoryPage = () => {
  const { slug } = useParams();
  const category = categoryData[slug || "call-handling"] || categoryData["call-handling"];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Section */}
      <div className="relative h-72">
        <img 
          src={category.image} 
          alt={category.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4">
          <Link to="/buyer-dashboard" className="p-2 bg-background/30 backdrop-blur-sm rounded-full">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Link>
          <div className="flex gap-2">
            <button className="p-2 bg-background/30 backdrop-blur-sm rounded-full">
              <Heart className="h-6 w-6 text-foreground" />
            </button>
            <button className="p-2 bg-background/30 backdrop-blur-sm rounded-full">
              <Share2 className="h-6 w-6 text-foreground" />
            </button>
          </div>
        </header>

        {/* Category Info */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex gap-2 mb-2">
            <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Verified Category
            </span>
            <span className="px-3 py-1 bg-secondary text-foreground text-xs rounded-full">
              Start at $25/hr
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{category.title}</h1>
        </div>
      </div>

      {/* Description */}
      <section className="px-4 py-6">
        <p className="text-muted-foreground leading-relaxed">{category.description}</p>
      </section>

      {/* Benefits */}
      <section className="px-4 py-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Why choose verified pros?</h2>
        <div className="space-y-3">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <benefit.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Rated Pros */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Top Rated Pros</h2>
          <Link to="/featured" className="text-sm text-primary hover:underline">
            See All
          </Link>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {topPros.map((pro) => (
            <Link 
              key={pro.id}
              to={`/seller/${pro.id}`}
              className="flex-shrink-0 bg-card border border-border rounded-xl overflow-hidden w-40"
            >
              <div className="relative">
                <img 
                  src={pro.image} 
                  alt={pro.name} 
                  className="w-full h-32 object-cover"
                />
                <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs">
                  <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  {pro.rating}
                </span>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-foreground">{pro.name}</h3>
                <p className="text-xs text-muted-foreground">{pro.languages}</p>
                {pro.verified && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-primary">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          <Button size="lg" className="w-full gap-2">
            Find Your Assistant
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CategoryPage;
