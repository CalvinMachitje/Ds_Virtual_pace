// src/pages/admin/LogsAdmin.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { useEffect } from "react";

type Log = {
  id: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
};

export default function LogsAdmin() {
  const { data: logs, isLoading, error } = useQuery<Log[], Error>({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load logs");
      }

      const json = await res.json();

      // Runtime check to help TS
      if (!Array.isArray(json)) {
        throw new Error("Invalid logs response format");
      }

      return json as Log[];
    },
  });

  // Show toast on error (instead of invalid onError option)
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Could not load logs");
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton height={500} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="text-center text-red-400">
          <p className="text-xl mb-4">Failed to load logs</p>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!logs) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Audit Logs</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">User ID</TableHead>
                  <TableHead className="text-slate-400">Action</TableHead>
                  <TableHead className="text-slate-400">Details</TableHead>
                  <TableHead className="text-slate-400">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-white">{l.user_id}</TableCell>
                    <TableCell className="text-slate-300">{l.action}</TableCell>
                    <TableCell className="text-slate-300">{l.details}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(l.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}