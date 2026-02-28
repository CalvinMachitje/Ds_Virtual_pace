// src/pages/support/TicketDetail.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertCircle, MessageSquare } from "lucide-react";

type Reply = {
  id: string;
  sender_name: string;
  message: string;
  created_at: string;
  is_admin: boolean;
};

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();

  const { data, isLoading, error } = useQuery<{
    ticket: any;
    replies: Reply[];
  }>({
    queryKey: ["ticket-thread", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/support/${ticketId}/thread`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) throw new Error("Failed to load ticket");
      return res.json();
    },
    enabled: !!ticketId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-[300px] w-full"/>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-red-400 p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Failed to load ticket</h2>
          <p className="text-slate-400 mb-6">{(error as Error)?.message || "Ticket not found"}</p>
        </div>
      </div>
    );
  }

  const { ticket, replies } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">{ticket.subject}</h1>

        <Card className="bg-slate-900/70 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Ticket Details</span>
              <Badge
                variant={
                  ticket.status === "open" ? "outline" :
                  ticket.status === "resolved" ? "secondary" :
                  ticket.status === "escalated" ? "destructive" : "default"
                }
                className={
                  ticket.status === "resolved" ? "bg-green-600/20 text-green-400" :
                  ticket.status === "escalated" ? "bg-red-600/20 text-red-400" : ""
                }
              >
                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300">{ticket.description}</p>
            <p className="text-sm text-slate-500">
              Created: {new Date(ticket.created_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {replies.length === 0 ? (
              <p className="text-center text-slate-500 py-12">No replies yet</p>
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
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium">
                      {reply.sender_name || (reply.is_admin ? "Admin Team" : "You")}
                    </span>
                    <span>{new Date(reply.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap">{reply.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}