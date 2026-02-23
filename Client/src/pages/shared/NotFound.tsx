// src/pages/shared/NotFound.tsx
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-center md:ml-64">
      <h1 className="text-9xl font-bold text-white mb-4">404</h1>
      <h2 className="text-3xl font-semibold text-white mb-2">Page Not Found</h2>
      <p className="text-slate-400 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 px-8 text-lg gap-2">
          <Home className="h-5 w-5" /> Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}