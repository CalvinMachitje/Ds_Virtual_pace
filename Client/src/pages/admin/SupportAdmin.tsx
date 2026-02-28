// src/pages/admin/SupportAdmin.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertTriangle, XCircle, MessageSquare, Send, Eye, AlertCircle } from "lucide-react";
import Skeleton from "react-loading-skeleton";

type Ticket = {
  id: string;
  user_id: string;
  user_name?: string;
  subject: string;
  description: string;
  status: "open" | "resolved" | "escalated" | "closed";
  created_at: string;
  escalated_note?: string;
  escalated_at?: string;
};

type Reply = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name?: string;
  message: string;
  created_at: string;
  is_admin: boolean;
};

export default function SupportAdmin() {
  const queryClient = useQueryClient();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);

  // Fetch all tickets
  const { data: tickets = [], isLoading, error } = useQuery<Ticket[]>({
    queryKey: ["admin-support"],
    queryFn: async () => {
      const res = await fetch("/api/admin/support", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    },
  });

  // Fetch thread/replies for selected ticket
  const { data: replies = [], isLoading: threadLoading } = useQuery<Reply[]>({
    queryKey: ["ticket-thread", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const res = await fetch(`/api/admin/support/${selectedTicket.id}/thread`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load thread");
      return res.json();
    },
    enabled: !!selectedTicket && threadDialogOpen,
  });

  // Send reply mutation
  const sendReply = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      const res = await fetch(`/api/admin/support/${ticketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send reply");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Reply sent");
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["ticket-thread", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
    },
    onError: (err: any) => toast.error(err.message || "Reply failed"),
  });

  // Resolve ticket
  const resolveTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/admin/support/${ticketId}/resolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to resolve");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Ticket resolved");
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
    },
    onError: (err: any) => toast.error(err.message || "Resolve failed"),
  });

  // Escalate ticket
  const escalateTicket = useMutation({
    mutationFn: async ({ ticketId, note }: { ticketId: string; note: string }) => {
      const res = await fetch(`/api/admin/support/${ticketId}/escalate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ escalated_note: note.trim() }),
      });
      if (!res.ok) throw new Error("Failed to escalate");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Ticket escalated to technical team");
      setEscalateDialogOpen(false);
      setEscalateNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
    },
    onError: (err: any) => toast.error(err.message || "Escalation failed"),
  });

  const handleReply = (ticket: Ticket) => {
    if (!replyText.trim()) return toast.error("Reply cannot be empty");
    sendReply.mutate({ ticketId: ticket.id, message: replyText });
  };

  const handleEscalateClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setEscalateNote("");
    setEscalateDialogOpen(true);
  };

  const confirmEscalate = () => {
    if (!selectedTicket) return;
    if (escalateNote.trim().length < 20) return toast.error("Please provide at least 20 characters");
    escalateTicket.mutate({ ticketId: selectedTicket.id, note: escalateNote });
  };

  const openThread = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setThreadDialogOpen(true);
  };


  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-red-400 p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Failed to load tickets</h2>
          <p className="text-slate-400 mb-6">{(error as Error).message}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-support"] })}>
            Retry
          </Button>
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
            <CardTitle className="text-white">Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Subject</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets?.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-800/50">
                    <TableCell className="text-white">
                      {t.user_name || t.user_id.slice(0, 8) + "..."}
                    </TableCell>
                    <TableCell className="text-slate-300 font-medium">{t.subject}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "open" ? "outline" :
                          t.status === "resolved" ? "secondary" :
                          t.status === "escalated" ? "destructive" : "default"
                        }
                        className={
                          t.status === "resolved" ? "bg-green-600/20 text-green-400" :
                          t.status === "escalated" ? "bg-red-600/20 text-red-400" : ""
                        }
                      >
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {(t.status === "open" || t.status === "escalated") && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolveTicket.mutate(t.id)}
                            disabled={resolveTicket.isPending}
                            className="border-green-600 text-green-400 hover:bg-green-950"
                          >
                            Resolve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEscalateClick(t)}
                            disabled={t.status === "escalated"}
                            className="border-orange-600 text-orange-400 hover:bg-orange-950"
                          >
                            Escalate
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openThread(t)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Thread
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {tickets?.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No tickets found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reply Input (shown when ticket selected) */}
        {selectedTicket && (selectedTicket.status === "open" || selectedTicket.status === "escalated") && (
          <Card className="bg-slate-900/70 border-slate-700 mt-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Reply to: {selectedTicket.subject}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                className="min-h-[120px] bg-slate-800 text-white border-slate-700"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => handleReply(selectedTicket)}
                  disabled={sendReply.isPending || !replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {sendReply.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Escalation Dialog */}
        <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Escalate to Technical Team
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Use this when the issue requires developer/maintenance intervention.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              placeholder="Describe why this needs escalation (e.g., bug, payment failure, server error...)"
              className="min-h-[140px] bg-slate-800 text-white border-slate-700"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEscalateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmEscalate}
                disabled={escalateTicket.isPending || escalateNote.trim().length < 20}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Escalate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Thread/View Replies Dialog */}
        <Dialog open={threadDialogOpen} onOpenChange={setThreadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">
                Ticket Thread: {selectedTicket?.subject}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto space-y-4 py-4">
              {threadLoading ? (
                <Skeleton count={3} height={80} />
              ) : replies.length === 0 ? (
                <p className="text-center text-slate-500">No replies yet</p>
              ) : (
                replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg ${
                      reply.is_admin
                        ? "bg-blue-950/40 border-l-4 border-blue-500 ml-8"
                        : "bg-slate-800/60 border-l-4 border-slate-500 mr-8"
                    }`}
                  >
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{reply.sender_name || (reply.is_admin ? "Admin" : "User")}</span>
                      <span>{new Date(reply.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap">{reply.message}</p>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setThreadDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}