// src/pages/admin/SupportAdmin.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: "open" | "closed";
  created_at: string;
};

export default function SupportAdmin() {
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-support"],
    queryFn: async () => {
      const res = await fetch("/api/admin/support", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error("Failed to load tickets: " + (err.error || "Unknown error"));
        throw new Error(err.error || "Failed");
      }

      return res.json();
    },
  });

  const closeTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/admin/support/${ticketId}/close`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to close ticket");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Ticket closed");
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
    },
    onError: (err: any) => toast.error(err.message || "Close failed"),
  });

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Support Tickets</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">User ID</TableHead>
                  <TableHead className="text-slate-400">Subject</TableHead>
                  <TableHead className="text-slate-400">Description</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-white">{t.user_id}</TableCell>
                    <TableCell className="text-slate-300">{t.subject}</TableCell>
                    <TableCell className="text-slate-300">{t.description}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-300">{t.status}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => closeTicket.mutate(t.id)}
                        disabled={t.status === "closed" || closeTicket.isPending}
                      >
                        Close Ticket
                      </Button>
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