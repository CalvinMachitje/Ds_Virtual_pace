// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type ProtectedRouteProps = {
  allowedRoles?: ("buyer" | "seller"| "admin")[];        // optional: restrict to specific roles
  redirectTo?: string;                          // optional: custom redirect path
};

export default function ProtectedRoute({
  allowedRoles,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { session, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!session) {
    return <Navigate to={redirectTo} replace />;
  }

  // Role restriction
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />; // or unauthorized page
  }

  return <Outlet />;
}