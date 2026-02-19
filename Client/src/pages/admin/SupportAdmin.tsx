// src/pages/admin/SupportAdmin.tsx (new file for support tickets)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
  const { data: tickets, isLoading, refetch } = useQuery<Ticket[]>({
    queryKey: ["admin-support"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets") // assume 'support_tickets' table
        .select("*");

      if (error) {
        toast.error("Failed to load tickets: " + error.message);
        throw error;
      }

      return data || [];
    },
  });

  const handleCloseTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", ticketId);

    if (error) {
      toast.error("Failed to close ticket: " + error.message);
    } else {
      toast.success("Ticket closed");
      refetch();
    }
  };

  if (isLoading) {
    return <Skeleton height={500} />;
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
                        onClick={() => handleCloseTicket(t.id)}
                        disabled={t.status === "closed"}
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