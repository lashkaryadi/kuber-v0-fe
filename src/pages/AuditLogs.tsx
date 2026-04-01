import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DataTable, Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/common/Pagination";
import api from "@/services/api";
import { toast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  performedBy?: {
    id: string;
    username: string;
  };
  createdAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  type PaginationMeta = {
    total: number;
    page: number;
    pages: number;
  };
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({ page, limit });
      // Map the response to match our interface
      const mappedLogs = (res.data || []).map((log: any) => ({
        ...log,
        // Keep the performedBy field as is
      }));
      setLogs(mappedLogs);
      setMeta(res.meta);
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
      setLogs([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm("Are you sure you want to clear all audit logs? This action cannot be undone.")) {
      try {
        const response = await api.clearAuditLogs();

        if (response.success) {
          toast({
            title: "Success",
            description: response.message || "Audit logs cleared successfully",
          });
          fetchLogs(); // Refresh the logs after clearing
        } else {
          toast({
            title: "Error",
            description: response.message || "Failed to clear audit logs",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Failed to clear audit logs", err);
        toast({
          title: "Error",
          description: "Failed to clear audit logs",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit]);

  const columns: Column<AuditLog>[] = [
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <span className="font-medium uppercase">{log.action}</span>
      ),
    },
    {
      key: "entityType",
      header: "Entity Type",
      render: (log) => (
        <span className="capitalize">{log.entityType}</span>
      ),
    },
    {
      key: "entityName",
      header: "Entity Name",
      render: (log) => (
        <span className="font-medium">{log.entityName}</span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (log) => log.performedBy?.username || "-",
    },
    {
      key: "createdAt",
      header: "Date",
      render: (log) =>
        new Date(log.createdAt).toLocaleString(),
    },
  ];

  return (
    <MainLayout title="Audit Logs">
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
          <div>
            <h2 className="text-lg font-semibold text-foreground">System Activity</h2>
            <p className="text-sm text-muted-foreground">
              Monitor user actions and system events
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => api.exportAuditLogsExcel()}
              className="hover:bg-primary/5 hover:text-primary transition-colors"
            >
              Export Excel
            </Button>

            <Button
              variant="destructive"
              onClick={handleClearLogs}
              className="gap-2 shadow-sm hover:shadow-md transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Clear Logs
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="royal-card overflow-hidden">
          <DataTable
            columns={columns}
            data={logs}
            loading={loading}
            keyExtractor={(log) => log.id}
            emptyMessage="No audit logs found"
          />
          {/* ✅ NEW: Customizable Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Pagination page={meta?.page || 1} totalPages={meta?.pages || 1} onChange={setPage} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
