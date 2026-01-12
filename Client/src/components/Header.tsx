import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Users } from "lucide-react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">D's Virtual Space</span>
          </a>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Become a Seller
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Business
            </a>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Sign In
          </Button>
          <Button size="sm">
            Join
          </Button>
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-6 w-6 text-foreground" /> : <Menu className="h-6 w-6 text-foreground" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-background p-4">
          <nav className="flex flex-col gap-4">
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Become a Seller
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Business
            </a>
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground">
                Sign In
              </Button>
              <Button size="sm" className="flex-1">
                Join
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
