// src/pages/admin/LogsAdmin.tsx
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, AlertCircle, Download, Search, Clock, Filter, Zap, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Papa from "papaparse";
import { io } from "socket.io-client";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type Log = {
  id: string;
  user_id: string;
  action: string;
  details: any;
  created_at: string;
};

const socket = io("http://196.253.26.123:5000", {
  auth: { token: localStorage.getItem("access_token") || "" },
  reconnection: true,
  reconnectionAttempts: 5,
});

export default function LogsAdmin() {
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [newLogCount, setNewLogCount] = useState(0);
  const pageSize = 20;

  const { 
    data: logsData, 
    isLoading, 
    error,
    isFetching 
  } = useQuery<{ logs: Log[]; total: number }>({
    queryKey: ["admin-logs", page, search, actionFilter, dateRange],
    queryFn: async () => {
      let url = `/api/admin/logs?page=${page}&limit=${pageSize}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (actionFilter !== "all") url += `&action=${actionFilter}`;
      if (dateRange !== "all") url += `&date_range=${dateRange}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load logs");
      }

      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const logs = logsData?.logs || [];
  const totalLogs = logsData?.total || 0;
  const totalPages = Math.ceil(totalLogs / pageSize);

  // Live streaming via Socket.IO
  useEffect(() => {
    socket.on("connect", () => {
      socket.emit("subscribe_logs");
      toast.success("Connected to live logs");
    });

    socket.on("new_log", (newLog: Log) => {
      if (!liveMode) {
        setNewLogCount(c => c + 1);
        return;
      }

      // Add to top of list (optimistic update)
      queryClient.setQueryData(["admin-logs", page, search, actionFilter, dateRange], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          logs: [newLog, ...old.logs.slice(0, pageSize - 1)],
          total: old.total + 1
        };
      });

      // Auto-scroll to top if user is at top
      if (tableRef.current && tableRef.current.scrollTop < 100) {
        tableRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }

      toast.info(`New log: ${newLog.action}`);
    });

    socket.on("disconnect", () => {
      toast.warning("Lost connection to live logs");
    });

    return () => {
      socket.emit("unsubscribe_logs");
      socket.off("new_log");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [liveMode, queryClient, page, search, actionFilter, dateRange]);

  const handleExportCSV = () => {
    if (!logs.length) return toast.warning("No logs to export");

    const csvData = logs.map(log => ({
      ID: log.id,
      UserID: log.user_id,
      Action: log.action,
      Details: JSON.stringify(log.details),
      Time: format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Logs exported");
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    toast.info("Refreshing logs...");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Clock className="h-8 w-8 text-purple-500" />
            Audit Logs
          </h1>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
              <Zap className="h-4 w-4 text-yellow-500" />
              <Switch
                checked={liveMode}
                onCheckedChange={setLiveMode}
                className="data-[state=checked]:bg-yellow-600"
              />
              <span className="text-sm text-slate-300">Live</span>
              {newLogCount > 0 && !liveMode && (
                <Badge variant="destructive" className="ml-1">
                  +{newLogCount}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="border-slate-600 text-slate-300"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!logs.length}
              className="border-slate-600 text-slate-300"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Action or details..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Action Type</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="update_profile">Profile Update</SelectItem>
                  <SelectItem value="create_gig">Gig Created</SelectItem>
                  <SelectItem value="verify_seller">Seller Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => { setDateRange(v as any); setPage(1); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={() => {
                  setSearch("");
                  setActionFilter("all");
                  setDateRange("all");
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center justify-between">
              System Activity
              <Badge variant="outline" className="bg-slate-800">
                {totalLogs} total • Page {page} of {totalPages || 1}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !logs.length ? (
              <div className="space-y-4">
                {Array.from({ length: 8}).map((_,i) =>(
                  <Skeleton key={i} className="h-16 w-full"/>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-16 text-red-400 border border-dashed border-red-800/50 rounded-lg">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Failed to load logs</p>
                <p className="text-sm opacity-80 mb-6">{(error as Error).message}</p>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-logs"] })} className="bg-red-600 hover:bg-red-700">
                  Retry
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 border border-dashed border-slate-700 rounded-lg">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">No audit logs found</p>
                <p className="mt-2">System activity will appear here</p>
              </div>
            ) : (
              <>
                <div ref={tableRef} className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-900 z-10">
                      <TableRow>
                        <TableHead className="text-slate-400">User ID</TableHead>
                        <TableHead className="text-slate-400">Action</TableHead>
                        <TableHead className="text-slate-400">Details</TableHead>
                        <TableHead className="text-slate-400">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          <TableCell className="font-mono text-slate-300">
                            {log.user_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            {log.action}
                          </TableCell>
                          <TableCell className="text-slate-300 max-w-md truncate">
                            {typeof log.details === "object"
                              ? JSON.stringify(log.details).slice(0, 100) + "..."
                              : log.details || "-"}
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 flex-wrap gap-4">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="border-slate-600 text-slate-300 min-w-[100px]"
                    >
                      Previous
                    </Button>
                    <span className="text-slate-400 text-sm">
                      Page {page} of {totalPages} • {totalLogs} total logs
                    </span>
                    <Button
                      variant="outline"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="border-slate-600 text-slate-300 min-w-[100px]"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Log Details Modal */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white text-xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Log Details
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  Detailed view of audit log entry including full JSON payload.
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-slate-400">Log ID</Label>
                    <p className="text-white font-mono mt-1 break-all">{selectedLog.id}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">User ID</Label>
                    <p className="text-white font-mono mt-1">{selectedLog.user_id}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Action</Label>
                    <p className="text-white font-medium mt-1">{selectedLog.action}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Timestamp</Label>
                    <p className="text-white mt-1">
                      {format(new Date(selectedLog.created_at), "PPPpp")} 
                      <br />
                      <span className="text-slate-500">
                        ({formatDistanceToNow(new Date(selectedLog.created_at), { addSuffix: true })})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-400">Full Details (JSON)</Label>
                  <pre className="bg-slate-900 p-4 rounded-lg overflow-auto text-sm text-slate-300 border border-slate-700 max-h-[400px] whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}