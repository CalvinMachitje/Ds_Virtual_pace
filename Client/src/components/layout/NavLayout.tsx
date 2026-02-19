// src/components/layout/NavLayout.tsx   (recommended rename from BottomNav.tsx)
import { useState } from "react";
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
  Users,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  Store,
  Wrench,
  UserCircle,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Nav item shape
interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
  exact?: boolean;
  onClick?: () => void;
  adminOnly?: boolean;
  section?: string;
}

export default function NavLayout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const { userRole, user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ────────────────────────────────────────────────
  // Unread message count (only for non-admin roles)
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

      if (error) {
        console.error("Unread count error:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id && userRole !== "admin",
    refetchInterval: 30000,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id || userRole === "admin") return;

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
          queryClient.setQueryData<number>(["unread-messages", user.id], (old = 0) => old + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, userRole]);

  // ────────────────────────────────────────────────
  // Navigation items
  // ────────────────────────────────────────────────
  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", exact: true, section: "general" },

    ...(userRole === "buyer"
      ? [
          { icon: Briefcase, label: "Gigs", path: "/gigs", exact: true, section: "marketplace" },
          { icon: Calendar, label: "My Bookings", path: "/my-bookings", exact: true, section: "marketplace" },
        ]
      : []),

    ...(userRole === "seller"
      ? [
          { icon: Briefcase, label: "My Gigs", path: "/my-gigs", exact: true, section: "marketplace" },
          { icon: ClipboardList, label: "Bookings", path: "/seller-bookings", exact: true, section: "marketplace" },
        ]
      : []),

    ...(userRole === "admin"
      ? [
          { icon: Users, label: "Users", path: "/admin/users", section: "admin" },
          { icon: FileText, label: "Gigs", path: "/admin/gigs", section: "admin" },
          { icon: Calendar, label: "Bookings", path: "/admin/bookings", section: "admin" },
          { icon: ShieldCheck, label: "Verifications", path: "/admin/verifications", section: "admin" },
          { icon: CreditCard, label: "Payments", path: "/admin/payments", section: "admin" },
          { icon: BarChart3, label: "Analytics", path: "/admin/analytics", section: "admin" },
          { icon: Settings, label: "Settings", path: "/admin/settings", section: "admin" },
        ]
      : []),

    {
      icon: MessageSquare,
      label: "Messages",
      path: userRole === "buyer" ? "/messages/buyer" : userRole === "seller" ? "/messages/seller" : "/admin/support",
      exact: false,
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
      exact: true,
      section: "account",
    },
    {
      icon: LogOut,
      label: "Logout",
      path: "#",
      exact: true,
      onClick: async () => {
        try {
          await signOut();
          toast.success("Logged out successfully");
          navigate("/login");
        } catch {
          toast.error("Logout failed");
        }
      },
      section: "account",
    },
  ];

  // ────────────────────────────────────────────────
  // Sidebar / Sheet Content (shared for desktop & mobile)
  // ────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full p-6">
      <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
        {userRole === "admin" ? (
          <>
            <ShieldCheck className="h-7 w-7 text-blue-500" />
            Admin Panel
          </>
        ) : (
          <>
            <LayoutDashboard className="h-7 w-7 text-blue-500" />
            Dashboard
          </>
        )}
      </h2>

      <Accordion type="multiple" defaultValue={["general", "account"]} className="space-y-4 flex-1">
        {/* General */}
        <AccordionItem value="general" className="border-none">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-slate-300" />
              <span className="text-lg font-semibold text-slate-200">General</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-2 pl-8">
            <nav className="space-y-1">
              {navItems
                .filter((item) => item.section === "general")
                .map((item) => (
                  <SidebarLink key={item.path} item={item} isActive={currentPath === item.path || currentPath.startsWith(item.path + "/")} />
                ))}
            </nav>
          </AccordionContent>
        </AccordionItem>

        {/* Marketplace */}
        {(userRole === "buyer" || userRole === "seller") && (
          <AccordionItem value="marketplace" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-slate-300" />
                <span className="text-lg font-semibold text-slate-200">Marketplace</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pl-8">
              <nav className="space-y-1">
                {navItems
                  .filter((item) => item.section === "marketplace")
                  .map((item) => (
                    <SidebarLink key={item.path} item={item} isActive={currentPath === item.path || currentPath.startsWith(item.path + "/")} />
                  ))}
              </nav>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Admin Tools */}
        {userRole === "admin" && (
          <AccordionItem value="admin" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-slate-300" />
                <span className="text-lg font-semibold text-slate-200">Admin Tools</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pl-8">
              <nav className="space-y-1">
                {navItems
                  .filter((item) => item.adminOnly)
                  .map((item) => (
                    <SidebarLink key={item.path} item={item} isActive={currentPath === item.path || currentPath.startsWith(item.path + "/")} />
                  ))}
              </nav>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Account */}
        <AccordionItem value="account" className="border-none">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center gap-3">
              <UserCircle className="h-5 w-5 text-slate-300" />
              <span className="text-lg font-semibold text-slate-200">Account</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-2 pl-8">
            <nav className="space-y-1">
              {navItems
                .filter((item) => item.section === "account" && !item.onClick)
                .map((item) => (
                  <SidebarLink key={item.path} item={item} isActive={currentPath === item.path || currentPath.startsWith(item.path + "/")} />
                ))}

              {navItems.find((item) => item.onClick) && (
                <button
                  onClick={navItems.find((item) => item.onClick)?.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              )}
            </nav>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  // ────────────────────────────────────────────────
  // Sidebar Link
  // ────────────────────────────────────────────────
  const SidebarLink = ({ item, isActive }: { item: NavItem; isActive: boolean }) => (
    <Link
      to={item.path}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        isActive ? "bg-blue-600/20 text-blue-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
      )}
      onClick={() => setMobileOpen(false)}
    >
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  );

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  return (
    <>
      {/* Desktop fixed sidebar (md+ screens) */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 bg-slate-950/90 border-r border-slate-800 z-40 overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger trigger + slide-in sheet */}
      {userRole !== "admin" ? (
        // Only show bottom nav for non-admin roles
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 md:hidden">
          <div className="flex justify-around h-16 px-2">
            {navItems.map((item) => {
              if (item.onClick) {
                return (
                  <button
                    key="logout"
                    onClick={item.onClick}
                    className="flex flex-col items-center justify-center flex-1 py-1 text-red-400 hover:text-red-300"
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs mt-1">{item.label}</span>
                  </button>
                );
              }

              const isActive = item.exact ? currentPath === item.path : currentPath.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 py-1 transition-colors",
                    isActive ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <div className={cn("p-2 rounded-full", isActive && "bg-blue-600/20")}>
                    <item.icon className="h-6 w-6" />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs mt-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : (
        // Admin: only hamburger menu (no bottom nav)
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden fixed top-4 left-4 z-50">
            <Button variant="ghost" size="icon" className="text-white">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-slate-950 border-slate-800 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}