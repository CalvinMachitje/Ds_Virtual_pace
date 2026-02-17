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
} from "react-router-dom";

// Pages
import Index from "./pages/shared/Index";
import LoginPage from "./pages/Auth/LoginPage";
import SignupPage from "./pages/Auth/SignupPage";
import ForgotPassword from "./pages/shared/ForgotPassword";
import ResetPassword from "./pages/shared/ResetPassword";
import NotFound from "./pages/shared/NotFound";
import Gigs from "./pages/shared/Gigs";
import GigDetail from "./pages/shared/GigDetail";
import BuyerProfile from "./pages/Buyer/BuyerProfile";
import Settings from "./pages/shared/Settings";

// Dashboard & Marketplace Pages
import BuyerDashboard from "./pages/Buyer/BuyerDashboard";
import SellerDashboard from "./pages/Seller/SellerDashboard";
import SellerProfile from "./pages/Seller/SellerProfile";
import CreateGig from "./pages/Seller/CreateGig";
import BookingPage from "./pages/shared/BookingPage";
import CategoryPage from "./pages/shared/CategoryPage";
import BuyerMessagePage from "./pages/Buyer/BuyerMessagePage";
import VerificationStatus from "./pages/shared/VerificationStatus";
import ReviewBooking from "./pages/shared/ReviewBooking";
import SellerMessagesPage from "./pages/Seller/SellerMessagesPage";
import MyGigs from "./pages/Seller/MyGigs";
import EditGig from "./pages/Seller/EditGig";
import MyBookings from "./pages/Buyer/MyBookings";
import SellerBookings from "./pages/Seller/SellerBookings";
import ChatPage from "./pages/shared/Chat";

// Supabase Auth & Layout
import { useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/layout/BottomNav";

const queryClient = new QueryClient();

// ────────────────────────────────────────────────
// Protected Layout (with mobile bottom nav)
// ────────────────────────────────────────────────
const ProtectedLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col">
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

// ────────────────────────────────────────────────
// General Protected Route (any logged-in user)
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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// ────────────────────────────────────────────────
// Buyer-only Protected Route
// ────────────────────────────────────────────────
const BuyerProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, userRole, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white bg-slate-950">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (userRole !== "buyer") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

// ────────────────────────────────────────────────
// Seller-only Protected Route
// ────────────────────────────────────────────────
const SellerProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, userRole, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white bg-slate-950">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (userRole !== "seller") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

// ────────────────────────────────────────────────
// Dashboard Switcher (renders correct dashboard based on role)
// ────────────────────────────────────────────────
const DashboardSwitcher = () => {
  const { userRole } = useAuth();
  return userRole === "seller" ? <SellerDashboard /> : <BuyerDashboard />;
};

const App = () => {
  const { session, loading } = useAuth();

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
            {/* Public routes */}
            <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes (any logged-in user) */}
            <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
              {/* Dashboard – switches based on role */}
              <Route path="/dashboard" element={<DashboardSwitcher />} />

              {/* Shared / general pages */}
              <Route path="/gigs" element={<Gigs />} />
              <Route path="/gig/:id" element={<GigDetail />} />
              <Route path="/profile/:id" element={<BuyerProfile />} />
              <Route path="/seller-profile/:id" element={<SellerProfile />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/verification/:id" element={<VerificationStatus />} />
              <Route path="/review-booking/:id" element={<ReviewBooking />} />
              <Route path="/booking/:id" element={<BookingPage />} />
              <Route path="/settings" element={<Settings />} />

              {/* Messages & Chat */}
              <Route path="/messages/buyer" element={<BuyerMessagePage />} />
              <Route path="/messages/seller" element={<SellerMessagesPage />} />
              <Route path="/chat/:sellerId" element={<ChatPage />} /> {/* Direct seller chat */}

              {/* Bookings */}
              <Route path="/my-bookings" element={<MyBookings />} />
            </Route>

            {/* Buyer-only protected routes */}
            <Route element={<BuyerProtectedRoute><ProtectedLayout /></BuyerProtectedRoute>}>
              {/* Add buyer-specific pages here if needed in future */}
            </Route>

            {/* Seller-only protected routes */}
            <Route element={<SellerProtectedRoute><ProtectedLayout /></SellerProtectedRoute>}>
              <Route path="/create-gig" element={<CreateGig />} />
              <Route path="/my-gigs" element={<MyGigs />} />
              <Route path="/edit-gig/:id" element={<EditGig />} />
              <Route path="/seller-bookings" element={<SellerBookings />} />
              <Route path="/chat/:bookingId" element={<ChatPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;