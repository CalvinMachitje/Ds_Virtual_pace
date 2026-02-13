// src/components/layout/BottomNav.tsx
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Search,
  Calendar,
  MessageSquare,
  User,
  Briefcase,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

// Define the shape of each nav item
interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number; // optional unread count
}

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { userRole, user } = useAuth();

  // ────────────────────────────────────────────────
  // Unread message count (realtime)
  // ────────────────────────────────────────────────
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["unread-messages", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
  
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);
  
      if (error) {
        console.error("Unread count error:", error);
        return 0;
      }
  
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // fallback poll every 30s
  });
  
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!user?.id) return;
  
    const channel = supabase
      .channel(`unread-messages:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          // Optimistic +1 when new message arrives
          queryClient.setQueryData<number>(["unread-messages", user.id], (old = 0) => old + 1);
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // ────────────────────────────────────────────────
  // Nav items – now typed with badge?
  // ────────────────────────────────────────────────
  const sharedItems: NavItem[] = [
    { icon: Home, label: "Home", path: "/dashboard" },
  ];

  const buyerItems: NavItem[] = [
    { icon: Search, label: "Search", path: "/Gigs" },
    { icon: Calendar, label: "Bookings", path: "/pages/ManageBookings" },
  ];

  const sellerItems: NavItem[] = [
    { icon: Briefcase, label: "Gigs", path: "/Gigs" },
    { icon: ClipboardList, label: "Manage", path: "/pages/BookingPages" },
  ];

  const bottomItems: NavItem[] = [
    {
      icon: MessageSquare,
      label: "Messages",
      path: "/chat/",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { icon: User, label: "Profile", path: "/pages/Profile/" },
  ];

  const navItems: NavItem[] = [
    ...sharedItems,
    ...(userRole === "buyer" ? buyerItems : sellerItems),
    ...bottomItems,
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            currentPath === item.path ||
            currentPath.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 py-1 transition-colors",
                isActive ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" />

                {/* Unread badge on Messages */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-md">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>

              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}