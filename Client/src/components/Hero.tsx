import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Hero = () => {
  const popularSearches = ["Logo Design", "WordPress", "Video Editing", "AI Services"];

  return (
    <section className="relative overflow-hidden bg-background py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>
      
      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Logo Icon */}
          <div className="flex justify-center mb-8 animate-fade-up">
            <div className="p-6 bg-primary rounded-2xl shadow-lg">
              <Users className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 animate-fade-up">
            D's Virtual Space
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Access your personal team of talented freelancers
          </p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for any service..."
                className="pl-12 h-14 text-base bg-input border-border focus:border-primary"
              />
            </div>
            <Button size="lg" className="h-14 px-8">
              Search
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <span className="text-sm">Popular:</span>
            {popularSearches.map((search) => (
              <a
                key={search}
                href="#"
                className="text-sm px-3 py-1.5 rounded-full bg-secondary border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {search}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
