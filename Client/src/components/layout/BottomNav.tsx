import { Link, useLocation } from "react-router-dom";
import { Home, Search, Calendar, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Search, label: "Search", href: "/Gigs" },
    { icon: Calendar, label: "Bookings", href: "/bookings" },
    { icon: MessageSquare, label: "Messages", href: "/chat/example" }, // replace with real chat route later
    { icon: User, label: "Profile", href: "/profile/me" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 transition-colors",
                isActive ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}