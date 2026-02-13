import { Home, Search, Plus, MessageSquare, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/buyer-dashboard" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: Plus, label: "Post", path: "/post-job", isCenter: true },
  { icon: MessageSquare, label: "Inbox", path: "/inbox" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          if (item.isCenter) {
            return (
              <Link
                key={item.label}
                to={item.path}
                className="flex items-center justify-center w-12 h-12 bg-primary rounded-full -mt-6 shadow-lg hover:bg-primary/90 transition-colors"
              >
                <item.icon className="h-6 w-6 text-primary-foreground" />
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-3 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
