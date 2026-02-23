// src/pages/admin/PaymentsAdmin.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payments", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error("Failed to load payments: " + (err.error || "Unknown error"));
        throw new Error(err.error || "Failed");
      }

      return res.json();
    },
  });

  const refundPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ status: "refunded" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Refund failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment refunded");
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (err: any) => toast.error(err.message || "Refund failed"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton height={500} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
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
                        onClick={() => refundPayment.mutate(p.id)}
                        disabled={p.status === "refunded" || refundPayment.isPending}
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