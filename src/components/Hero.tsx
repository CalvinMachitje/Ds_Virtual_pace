import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Hero = () => {
  const popularSearches = ["Logo Design", "WordPress", "Video Editing", "AI Services"];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90 py-20 md:py-32">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
      
      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 animate-fade-up">
            Find the perfect <span className="italic">freelance</span> services for your business
          </h1>
          
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Connect with talented freelancers and get quality work done
          </p>

          <div className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto mb-6 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for any service..."
                className="pl-12 h-14 text-base bg-background border-0 shadow-lg"
              />
            </div>
            <Button size="lg" className="h-14 px-8 bg-foreground text-background hover:bg-foreground/90">
              Search
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-primary-foreground/80 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <span className="text-sm">Popular:</span>
            {popularSearches.map((search) => (
              <a
                key={search}
                href="#"
                className="text-sm px-3 py-1 rounded-full border border-primary-foreground/30 hover:bg-primary-foreground/10 transition-colors"
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
