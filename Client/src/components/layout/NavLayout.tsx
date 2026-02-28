// src/components/layout/NavLayout.tsx
import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Wrench,
  UserCircle,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  BarChart3,
  Briefcase,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  Settings,
  ShieldCheck,
  Users,
  HistoryIcon,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Skeleton from "react-loading-skeleton";

// ────────────────────────────────────────────────
// Nav item definition
// ────────────────────────────────────────────────
interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
  exact?: boolean;
  onClick?: () => void;
  adminOnly?: boolean;
  section: "general" | "marketplace" | "admin" | "account";
}

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  const queryClient = useQueryClient();

  // ────────────────────────────────────────────────
  // Unread messages count (real-time)
  // ────────────────────────────────────────────────
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["unread-messages", user?.id],
    queryFn: async () => {
      if (!user?.id || userRole === "admin") return 0;

      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id && userRole !== "admin" && !loading,
    staleTime: 30_000,
  });

  // Real-time unread message updates
  useEffect(() => {
    if (!user?.id || userRole === "admin" || loading) return;

    const channel = supabase
      .channel(`unread-messages-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          queryClient.setQueryData<number>(["unread-messages", user.id], (old = 0) => old + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.read_at && !payload.old.read_at) {
            queryClient.setQueryData<number>(["unread-messages", user.id], (old = 0) => Math.max(0, old - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((err) => {
        console.warn("Failed to remove channel:", err);
      });
    };
  }, [user?.id, userRole, loading, queryClient]);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // ────────────────────────────────────────────────
  // Navigation items (dynamic based on role)
  // ────────────────────────────────────────────────
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        path: "/dashboard",
        exact: true,
        section: "general",
      },
    ];

    if (userRole === "buyer") {
      items.push(
        { icon: Briefcase, label: "Gigs", path: "/gigs", section: "marketplace" },
        { icon: Calendar, label: "My Bookings", path: "/my-bookings", section: "marketplace" },
        // Added: Support link for buyers
        {
          icon: MessageSquare,
          label: "Support",
          path: "/support",
          section: "account",
        }
      );
    }

    if (userRole === "seller") {
      items.push(
        { icon: Briefcase, label: "My Gigs", path: "/my-gigs", section: "marketplace" },
        { icon: ClipboardList, label: "Bookings", path: "/seller-bookings", section: "marketplace" },
        // Added: Support link for sellers
        {
          icon: MessageSquare,
          label: "Support",
          path: "/support",
          section: "account",
        }
      );
    }

    if (userRole === "admin") {
      items.push(
        { icon: Users, label: "Users", path: "/admin/users", adminOnly: true, section: "admin" },
        { icon: FileText, label: "Gigs", path: "/admin/gigs", adminOnly: true, section: "admin" },
        { icon: Calendar, label: "Bookings", path: "/admin/bookings", adminOnly: true, section: "admin" },
        { icon: ShieldCheck, label: "Verifications", path: "/admin/verifications", adminOnly: true, section: "admin" },
        { icon: CreditCard, label: "Payments", path: "/admin/payments", adminOnly: true, section: "admin" },
        { icon: BarChart3, label: "Analytics", path: "/admin/analytics", adminOnly: true, section: "admin" },
        { icon: Settings, label: "Settings", path: "/admin/settings", adminOnly: true, section: "admin" },
        { icon: MessageCircle, label: "Support", path: "/admin/support", adminOnly: true, section: "admin" },
        { icon: HistoryIcon, label: "Audit Logs", path: "/admin/logs", adminOnly: true, section: "admin" }

      );
    }

    items.push(
      {
        icon: MessageSquare,
        label: "Messages",
        path:
          userRole === "buyer" || userRole === "seller"
            ? "/messages"
            : "/admin/support",
        badge: unreadCount > 0 ? unreadCount : undefined,
        section: "account",
      },
      {
        icon: UserCircle,
        label: "Profile",
        path:
          userRole === "buyer"
            ? user?.id
              ? `/profile/${user.id}`
              : "#"
            : userRole === "seller"
            ? user?.id
              ? `/seller-profile/${user.id}`
              : "#"
            : "/admin/profile",
        section: "account",
      },
      {
        icon: LogOut,
        label: "Logout",
        path: "#",
        onClick: async () => {
          try {
            await signOut();
            queryClient.clear();
            toast.success("Logged out successfully");
            navigate("/login");
          } catch (err) {
            toast.error("Logout failed");
          }
        },
        section: "account",
      }
    );

    return items;
  }, [userRole, user?.id, unreadCount, signOut, navigate, queryClient]);

  // ────────────────────────────────────────────────
  // Sidebar Content (shared between desktop & mobile)
  // ────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-slate-800/70">
        <div className="flex items-center gap-3">
          {userRole === "admin" ? (
            <ShieldCheck className="h-7 w-7 text-blue-500" />
          ) : (
            <LayoutDashboard className="h-7 w-7 text-blue-500" />
          )}
          {!isCollapsed && (
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {userRole === "admin" ? "Admin" : "Dashboard"}
            </h2>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex text-slate-400 hover:text-white"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div
        className={cn(
          "flex-1 overflow-y-auto px-3 py-4 transition-all duration-300",
          isCollapsed ? "w-16 items-center" : "w-64"
        )}
      >
        <Accordion type="multiple" defaultValue={["general", "account"]} className="space-y-4">
          <AccordionItem value="general" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-5 w-5 text-slate-300" />
                {!isCollapsed && <span className="font-medium text-slate-200">General</span>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {navItems
                .filter((item) => item.section === "general")
                .map((item) => (
                  <SidebarLink key={item.path} item={item} isCollapsed={isCollapsed} />
                ))}
            </AccordionContent>
          </AccordionItem>

          {(userRole === "buyer" || userRole === "seller") && (
            <AccordionItem value="marketplace" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-3">
                  <Store className="h-5 w-5 text-slate-300" />
                  {!isCollapsed && <span className="font-medium text-slate-200">Marketplace</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {navItems
                  .filter((item) => item.section === "marketplace")
                  .map((item) => (
                    <SidebarLink key={item.path} item={item} isCollapsed={isCollapsed} />
                  ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {userRole === "admin" && (
            <AccordionItem value="admin" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-slate-300" />
                  {!isCollapsed && <span className="font-medium text-slate-200">Admin Tools</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {navItems
                  .filter((item) => item.adminOnly)
                  .map((item) => (
                    <SidebarLink key={item.path} item={item} isCollapsed={isCollapsed} />
                  ))}
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="account" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-3">
                <UserCircle className="h-5 w-5 text-slate-300" />
                {!isCollapsed && <span className="font-medium text-slate-200">Account</span>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {navItems
                .filter((item) => item.section === "account" && !item.onClick)
                .map((item) => (
                  <SidebarLink key={item.path} item={item} isCollapsed={isCollapsed} />
                ))}

              <button
                onClick={navItems.find((i) => i.onClick)?.onClick}
                className={cn(
                  "mt-2 w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors",
                  isCollapsed && "justify-center px-2"
                )}
                aria-label="Log out"
              >
                <LogOut className="h-5 w-5" />
                {!isCollapsed && <span>Logout</span>}
              </button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );

  const SidebarLink = ({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) => {
    const location = useLocation();
    const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

    if (item.onClick) return null;

    return (
      <Link
        to={item.path}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
          isActive ? "bg-blue-600/20 text-blue-400" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100",
          isCollapsed && "justify-center px-3"
        )}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span>{item.label}</span>}

        {item.badge !== undefined && item.badge > 0 && (
          <span
            className={cn(
              "ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full",
              isCollapsed && "absolute -top-1 -right-1 min-w-[18px] h-5 flex items-center justify-center"
            )}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}

        {isCollapsed && (
          <div className="absolute left-full ml-2 hidden group-hover:block bg-slate-900 text-white text-sm px-3 py-2 rounded-md shadow-lg whitespace-nowrap z-50">
            {item.label}
            {item.badge !== undefined && item.badge > 0 && ` (${item.badge})`}
          </div>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <aside className="hidden md:block w-64 bg-slate-950 border-r border-slate-800">
          <div className="p-4 space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </aside>
        <main className="flex-1 p-6">
          <Skeleton className="h-12 w-1/3 mb-6" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const isAdmin = userRole === "admin";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:block fixed inset-y-0 left-0 z-30 bg-slate-950 border-r border-slate-800 shadow-2xl transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Menu (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="md:hidden fixed top-4 left-4 z-50">
          <Button variant="ghost" size="icon" className="text-white bg-slate-900/60 backdrop-blur-sm">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 border-slate-800 bg-slate-950">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 min-h-screen",
          isCollapsed ? "md:ml-16" : "md:ml-64",
          "pt-16 md:pt-0", // mobile header offset
          "pb-24 md:pb-0"  // mobile bottom nav offset
        )}
      >
        {children}
      </main>

      {/* Mobile Bottom Nav – only for buyer/seller */}
      {!isAdmin && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 md:hidden">
          <div className="flex justify-around items-center h-16 px-2 max-w-screen-sm mx-auto">
            {navItems.map((item) => {
              // Only show relevant items in bottom nav (exclude admin-only)
              if (item.adminOnly) return null;

              if (item.onClick) {
                return (
                  <button
                    key="logout"
                    onClick={item.onClick}
                    className="flex flex-col items-center flex-1 py-1 text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Log out"
                  >
                    <LogOut className="h-6 w-6" />
                    <span className="text-xs mt-1">{item.label}</span>
                  </button>
                );
              }

              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center flex-1 py-1 transition-colors",
                    isActive ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="relative">
                    <item.icon className="h-6 w-6" />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-5 px-1.5 rounded-full flex items-center justify-center">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs mt-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}