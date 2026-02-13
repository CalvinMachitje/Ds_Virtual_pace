// File: Client/src/App.tsx
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";
import { Home, Search, Calendar, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Pages
import Index from "./pages/Index";
import LoginPage from "./pages/Login_Page";
import SignupPage from "./pages/Signup_Page";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import Gigs from "./pages/Gigs";
import CreateGig from "./pages/CreateGig";
import GigDetail from "./pages/GigDetail";
import Profile from "./pages/Profile";

// Dashboard & Marketplace Pages
import BuyerDashboard from "./pages/BuyerDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import SellerProfile from "./pages/SellerProfile";
import BookingPage from "./pages/BookingPage";
import CategoryPage from "./pages/CategoryPage";
import ManageBookings from "./pages/ManageBookings";
import ChatPage from "./pages/ChatPage";
import WorkerProfile from "./pages/WorkerProfile";
import VerificationStatus from "./pages/VerificationStatus";
import ReviewBooking from "./pages/ReviewBooking";

// Supabase Auth
import { useAuth } from "@/context/AuthContext";

const queryClient = new QueryClient();

// ────────────────────────────────────────────────
// Bottom Navigation Component (mobile)
// ────────────────────────────────────────────────
const BottomNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Search, label: "Search", path: "/Gigs" },
    { icon: Calendar, label: "Bookings", path: "/bookings" },
    { icon: MessageSquare, label: "Messages", path: "/chat/" }, // prefix match
    { icon: User, label: "Profile", path: "/profile/" },        // prefix match
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
};

// ────────────────────────────────────────────────
// Layout for all authenticated/protected pages
// ────────────────────────────────────────────────
const ProtectedLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col">
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Optional future desktop sidebar */}
      {/* 
      <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-64 bg-slate-900/80 border-r border-slate-800 p-6">
        Desktop sidebar content...
      </aside>
      */}
    </div>
  );
};

// ────────────────────────────────────────────────
// Protected Route Wrapper
// ────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-slate-950">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/Login_Page" replace />;
  }

  return <>{children}</>;
};

// ────────────────────────────────────────────────
// Main App Component
// ────────────────────────────────────────────────
const App = () => {
  const { session, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-slate-950">
        Loading...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* ── Public / Pre-login Routes ── */}
            <Route
              path="/"
              element={session ? <Navigate to="/dashboard" replace /> : <Index />}
            />
            <Route path="/Login_Page" element={<LoginPage />} />
            <Route path="/Signup_Page" element={<SignupPage />} />
            <Route path="/ForgotPassword" element={<ForgotPassword />} />

            {/* ── Protected Routes (with layout + bottom nav) ── */}
            <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
              {/* Role-based Dashboard */}
              <Route
                path="/dashboard"
                element={
                  userRole === "seller" ? <SellerDashboard /> : <BuyerDashboard />
                }
              />

              {/* Marketplace & Core Features */}
              <Route path="/Gigs" element={<Gigs />} />
              <Route path="/gig/:id" element={<GigDetail />} />
              <Route path="/create-gig" element={<CreateGig />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/seller/:username" element={<SellerProfile />} />

              {/* From mockups & previous work */}
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/bookings" element={<ManageBookings />} />
              <Route path="/chat/:chatId" element={<ChatPage />} />
              <Route path="/worker/:id" element={<WorkerProfile />} />
              <Route path="/verification/:id" element={<VerificationStatus />} />
              <Route path="/review-booking/:id" element={<ReviewBooking />} />
              <Route path="/booking/:id" element={<BookingPage />} />
            </Route>

            {/* ── 404 Catch-all ── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;