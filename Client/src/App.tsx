// File: Client/src/App.tsx
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Pages
import Index from "./pages/Index";
import LoginPage from "./pages/Login_Page";
import ForgotPassword from "./pages/ForgotPassword";
import SignupPage from "./pages/Signup_Page";
import NotFound from "./pages/NotFound";
import Gigs from "./pages/Gigs";
import CreateGig from "./pages/CreateGig";
import GigDetail from "./pages/GigDetail";
import Profile from "./pages/Profile";

// Dashboard Pages
import BuyerDashboard from "./pages/BuyerDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import SellerProfile from "./pages/SellerProfile";
import BookingPage from "./pages/BookingPage";
import CategoryPage from "./pages/CategoryPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<Index />} />

          {/* Authentication Routes */}
          <Route path="/Login_Page" element={<LoginPage />} />
          <Route path="/Signup_Page" element={<SignupPage />} />
          <Route path="/ForgotPassword" element={<ForgotPassword />} />
          
          {/* Core Marketplace Routes */}
          <Route path="/Gigs" element={<Gigs />} />
          <Route path="/gig/:id" element={<GigDetail />} />
          <Route path="/create-gig" element={<CreateGig />} /> {/* protect later */}
          <Route path="/profile/:username" element={<Profile />} />
          {/* Catch-all 404 - must be last */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;