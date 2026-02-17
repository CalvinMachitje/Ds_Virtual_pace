// src/components/layout/BottomNav.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Search,
  Calendar,
  MessageSquare,
  User,
  Briefcase,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import { toast } from "sonner";

// Define the shape of each nav item
interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number; // optional unread count
  exact?: boolean; // optional: force exact match for active state
  onClick?: () => void; // optional: custom handler (for logout)
}

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const { userRole, user, loading, signOut } = useAuth(); // 'buyer' | 'seller'

  // ────────────────────────────────────────────────
  // Unread message count (realtime, shared for both roles)
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
  // Navigation items – role-specific + Logout
  // ────────────────────────────────────────────────
  const sharedItems: NavItem[] = [
    {
      icon: Home,
      label: "Home",
      path: "/dashboard",
      exact: true,
    },
  ];

  const buyerItems: NavItem[] = [
    {
      icon: Briefcase,
      label: "Gigs",
      path: "/gigs",
      exact: true,
    },
    {
      icon: Calendar,
      label: "Bookings",
      path: "/my-bookings",
      exact: true,
    },
  ];

  const sellerItems: NavItem[] = [
    {
      icon: Briefcase,
      label: "Gigs",
      path: "/my-gigs",
      exact: true,
    },
    {
      icon: ClipboardList,
      label: "Bookings",
      path: "/seller-bookings",
      exact: true,
    },
  ];

  const roleBottomItems: NavItem[] =
    userRole === "buyer"
      ? [
          {
            icon: MessageSquare,
            label: "Messages",
            path: "/messages/buyer",
            exact: false, // allow nested /chat/* to stay active
            badge: unreadCount > 0 ? unreadCount : undefined,
          },
          {
            icon: User,
            label: "Profile",
            path: user?.id ? `/profile/${user.id}` : "#",
            exact: true,
          },
        ]
      : [
          {
            icon: MessageSquare,
            label: "Messages",
            path: "/messages/seller",
            exact: false, // allow nested /chat/* to stay active
            badge: unreadCount > 0 ? unreadCount : undefined,
          },
          {
            icon: User,
            label: "Profile",
            path: user?.id ? `/seller-profile/${user.id}` : "#",
            exact: true,
          },
        ];

  const logoutItem: NavItem = {
    icon: LogOut,
    label: "Logout",
    path: "#", // dummy path – handled by onClick
    exact: true,
    onClick: async () => {
      try {
        await signOut();
        toast.success("Logged out successfully");
        navigate("/login");
      } catch (err: any) {
        toast.error("Logout failed");
      }
    },
  };

  const navItems: NavItem[] = [
    ...sharedItems,
    ...(userRole === "buyer" ? buyerItems : sellerItems),
    ...roleBottomItems,
    logoutItem, // always last
  ];

  // ────────────────────────────────────────────────
  // Loading state (skeleton nav while role/user is loading)
  // ────────────────────────────────────────────────
  if (loading || !userRole || !user?.id) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="h-8 w-8 bg-slate-700 rounded-full animate-pulse mb-1" />
              <div className="h-3 w-12 bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          if (item.onClick) {
            // Special case: Logout button
            return (
              <button
                key="logout"
                onClick={item.onClick}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200",
                  "text-red-400 hover:text-red-300 hover:scale-105"
                )}
              >
                <div className="p-3 rounded-full hover:bg-red-950/30 transition-all duration-300">
                  <item.icon className="h-6 w-6" />
                </div>
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </button>
            );
          }

          // Improved active detection: exact for top-level, startsWith for nested (chat, etc.)
          const isActive = item.exact
            ? currentPath === item.path
            : currentPath === item.path || currentPath.startsWith(item.path + "/");

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200",
                isActive
                  ? "text-blue-400 scale-110"
                  : "text-slate-400 hover:text-slate-200 hover:scale-105"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-full transition-all duration-300",
                  isActive ? "bg-blue-600/20" : "hover:bg-slate-800/50"
                )}
              >
                <item.icon className="h-6 w-6" />

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