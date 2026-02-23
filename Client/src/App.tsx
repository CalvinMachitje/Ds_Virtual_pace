// File: Client/src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect } from 'react';

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
import BuyerMessagePage from "./pages/Buyer/BuyerMessagePage"; // note: was BuyerMessagesPage in some files
import VerificationStatus from "./pages/shared/VerificationStatus";
import ReviewBooking from "./pages/shared/ReviewBooking";
import SellerMessagesPage from "./pages/Seller/SellerMessagesPage";
import MyGigs from "./pages/Seller/MyGigs";
import EditGig from "./pages/Seller/EditGig";
import MyBookings from "./pages/Buyer/MyBookings";
import SellerBookings from "./pages/Seller/SellerBookings";
import ChatPage from "./pages/shared/Chat";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsersAdmin from "./pages/admin/UsersAdmin";
import GigsAdmin from "./pages/admin/GigsAdmin";
import BookingsAdmin from "./pages/admin/BookingAdmin";
import VerificationsAdmin from "./pages/admin/VerificationsAdmin";
import PaymentsAdmin from "./pages/admin/PaymentsAdmin";
import AnalyticsAdmin from "./pages/admin/AnalyticsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import SupportAdmin from "./pages/admin/SupportAdmin";
import LogsAdmin from "./pages/admin/LogsAdmin";
import AdminProfile from "./pages/admin/AdminProfile";

// Isolated Admin Login
import AdminLogin from "./pages/admin/AdminLogin";

// Supabase Auth & Layout
import { useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/layout/NavLayout";

const queryClient = new QueryClient();

// ────────────────────────────────────────────────
// Role-specific layouts
// ────────────────────────────────────────────────
const BuyerLayout = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col">
    <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
      <Outlet />
    </main>
    <BottomNav children={""} />
  </div>
);

const SellerLayout = BuyerLayout; // Reuse for now

const AdminLayout = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col">
    <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
      <Outlet />
    </main>
    <BottomNav children={""} />
  </div>
);

// ────────────────────────────────────────────────
// Strict role guard
// ────────────────────────────────────────────────
type AllowedRoles = 'buyer' | 'seller' | 'admin';

const RequireRole = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: AllowedRoles[] }) => {
  const { session, loading, userRole, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      toast.error("Please log in to access this page");
      navigate("/login", { replace: true, state: { from: location } });
      return;
    }

    let currentRole: AllowedRoles | null = null;

    if (isAdmin) currentRole = "admin";
    else if (userRole === "buyer") currentRole = "buyer";
    else if (userRole === "seller") currentRole = "seller";

    if (!currentRole || !allowedRoles.includes(currentRole)) {
      toast.error(`Access denied. ${currentRole ? `(${currentRole})` : ""} users cannot access this area.`);

      const redirectMap: Record<AllowedRoles, string> = {
        buyer: "/dashboard",
        seller: "/dashboard",
        admin: "/admin",
      };

      const redirectTo = currentRole ? redirectMap[currentRole] : "/login";
      navigate(redirectTo, { replace: true });
    }
  }, [session, loading, userRole, isAdmin, navigate, allowedRoles, location]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-white">Verifying access...</div>;
  }

  return <>{children}</>;
};

// ────────────────────────────────────────────────
// Protected Layout (role-specific nav)
// ────────────────────────────────────────────────
const ProtectedLayout = () => {
  const { userRole } = useAuth();

  if (userRole === "admin") return <AdminLayout />;
  if (userRole === "buyer") return <BuyerLayout />;
  if (userRole === "seller") return <SellerLayout />;

  return <BuyerLayout />; // Fallback
};

// ────────────────────────────────────────────────
// Dashboard Switcher
// ────────────────────────────────────────────────
const DashboardSwitcher = () => {
  const { userRole } = useAuth();
  if (userRole === "admin") return <Navigate to="/admin" replace />;
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
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public marketplace routes (accessible without login) */}
            <Route path="/gigs" element={<Gigs />} />
            <Route path="/gig/:id" element={<GigDetail />} />
            <Route path="/category/:category" element={<CategoryPage />} />

            {/* Protected routes – strict role checks */}
            <Route element={<RequireRole allowedRoles={["buyer", "seller", "admin"]}><ProtectedLayout /></RequireRole>}>
              <Route path="/dashboard" element={<DashboardSwitcher />} />

              {/* Buyer-only routes */}
              <Route element={<RequireRole allowedRoles={["buyer"]}><Outlet /></RequireRole>}>
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/messages/buyer" element={<BuyerMessagePage />} />
                <Route path="/profile/:id" element={<BuyerProfile />} />
              </Route>

              {/* Seller-only routes */}
              <Route element={<RequireRole allowedRoles={["seller"]}><Outlet /></RequireRole>}>
                <Route path="/create-gig" element={<CreateGig />} />
                <Route path="/my-gigs" element={<MyGigs />} />
                <Route path="/edit-gig/:id" element={<EditGig />} />
                <Route path="/seller-bookings" element={<SellerBookings />} />
                <Route path="/messages/seller" element={<SellerMessagesPage />} />
                <Route path="/seller-profile/:id" element={<SellerProfile />} />
              </Route>

              {/* Admin-only routes */}
              <Route element={<RequireRole allowedRoles={["admin"]}><Outlet /></RequireRole>}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UsersAdmin />} />
                <Route path="/admin/gigs" element={<GigsAdmin />} />
                <Route path="/admin/bookings" element={<BookingsAdmin />} />
                <Route path="/admin/verifications" element={<VerificationsAdmin />} />
                <Route path="/admin/payments" element={<PaymentsAdmin />} />
                <Route path="/admin/analytics" element={<AnalyticsAdmin />} />
                <Route path="/admin/settings" element={<SettingsAdmin />} />
                <Route path="/admin/support" element={<SupportAdmin />} />
                <Route path="/admin/logs" element={<LogsAdmin />} />
                <Route path="/admin/profile" element={<AdminProfile />} />
              </Route>

              {/* Shared protected routes (buyer + seller + admin) */}
              <Route path="/booking/:id" element={<BookingPage />} />
              <Route path="/verification/:id" element={<VerificationStatus />} />
              <Route path="/review-booking/:id" element={<ReviewBooking />} />
              <Route path="/chat/:id" element={<ChatPage />} />           {/* generalized chat route */}
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* 404 - must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;