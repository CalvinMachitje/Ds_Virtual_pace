// src/pages/admin/PaymentsAdmin.tsx (Managing payments)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";

type Payment = {
  id: string;
  booking_id: string;
  amount: number;
  status: "pending" | "completed" | "refunded";
  created_at: string;
  method: string;
};

export default function PaymentsAdmin() {
  const { data: payments, isLoading, refetch } = useQuery<Payment[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments") // assume 'payments' table
        .select("*");

      if (error) {
        toast.error("Failed to load payments: " + error.message);
        throw error;
      }

      return data || [];
    },
  });

  const handleRefund = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", paymentId);

    if (error) {
      toast.error("Failed to refund: " + error.message);
    } else {
      toast.success("Payment refunded");
      refetch();
    }
  };

  if (isLoading) {
    return <Skeleton height={500} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Manage Payments</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">All Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">Booking ID</TableHead>
                  <TableHead className="text-slate-400">Amount</TableHead>
                  <TableHead className="text-slate-400">Method</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-white">{p.booking_id}</TableCell>
                    <TableCell className="text-slate-300">R{p.amount}</TableCell>
                    <TableCell className="text-slate-300">{p.method}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(p.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-slate-300">{p.status}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRefund(p.id)}
                        disabled={p.status === "refunded"}
                      >
                        Refund
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