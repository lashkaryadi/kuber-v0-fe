import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { DataTable, Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api, { SoldItem } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import {
  FileText,
  Undo2,
  Download,
  Search,
  RefreshCw,
  Ban,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

type PaginationMeta = {
  page: number;
  pages: number;
  total: number;
};

export default function SoldItems() {
  const navigate = useNavigate();
  const [soldItems, setSoldItems] = useState<SoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const salesRes = await api.getSales({
        page,
        limit,
        sortOrder: sortDir,
        search: searchText || undefined,
        includeCancelled: "true",
      });

      if (salesRes.success) {
        setSoldItems(Array.isArray(salesRes.data) ? salesRes.data : []);
        setMeta(salesRes.meta || null);
      } else {
        setSoldItems([]);
        setMeta(null);
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
      setSoldItems([]);
      setMeta(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, sortDir, searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleDataChanged = () => {
      fetchData(true);
    };

    window.addEventListener("kuber-data-changed", handleDataChanged);
    return () => window.removeEventListener("kuber-data-changed", handleDataChanged);
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const handleUndo = async (sale: SoldItem) => {
    const saleId = sale._id || sale.id;
    if (!saleId) return;

    if (!confirm(`Undo sale ${sale.saleRef || saleId}?\nThis will restore the inventory quantities.`)) {
      return;
    }

    const res = await api.undoSale(saleId);

    if (res.success) {
      toast({
        title: "Sale Undone",
        description: res.message || "Inventory quantities restored successfully.",
      });
      fetchData(true);
    } else {
      toast({
        title: "Error",
        description: res.message || "Failed to undo sale",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = async () => {
    const result = await api.exportSoldItemsExcel();
    if (result.success) {
      toast({ title: "Success", description: "Sales exported to Excel" });
    } else {
      toast({
        title: "Error",
        description: "Failed to export sales",
        variant: "destructive",
      });
    }
  };

  const handleGenerateInvoice = async () => {
    if (selectedIds.length === 0) return;

    setGeneratingInvoice(true);
    try {
      const res = await api.createBulkInvoice(selectedIds);
      const invoice = res?.data || res;

      if (invoice?._id) {
        toast({
          title: "Invoice Created",
          description: res?.message || `Invoice generated for ${selectedIds.length} sale(s)`,
        });
        setSelectedIds([]);
        navigate(`/invoice-preview/${invoice._id}`);
      } else {
        toast({
          title: "Error",
          description: res?.message || "Failed to create invoice",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || "Failed to generate invoice",
        variant: "destructive",
      });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleViewInvoice = (saleId: string) => {
    navigate(`/invoice/${saleId}`);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeIds = soldItems
        .filter((item) => !item.cancelled)
        .map((item) => item._id || item.id);
      setSelectedIds(activeIds);
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const columns: Column<SoldItem>[] = [
    {
      key: "checkbox",
      header: (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={
            selectedIds.length > 0 &&
            selectedIds.length ===
            soldItems.filter((i) => !i.cancelled).length
          }
          onChange={(e) => toggleSelectAll(e.target.checked)}
        />
      ),
      render: (item) => (
        <input
          type="checkbox"
          aria-label={`Select ${item.saleRef}`}
          disabled={item.cancelled}
          checked={selectedIds.includes(item._id || item.id)}
          onChange={(e) =>
            toggleSelectItem(item._id || item.id, e.target.checked)
          }
        />
      ),
    },
    {
      key: "saleRef",
      header: "Sale Ref",
      render: (item) => (
        <div>
          <span className="font-mono text-sm font-medium">
            {item.saleRef || "-"}
          </span>
          {item.cancelled && (
            <Badge variant="destructive" className="ml-2 text-[10px]">
              Cancelled
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "serialNumber",
      header: "Serial Number",
      render: (item) => (
        <span className="font-medium">
          {item.inventoryItem?.serialNumber ?? "-"}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item) => {
        const cat = item.inventoryItem?.category;
        return typeof cat === "object" ? cat?.name || "-" : "-";
      },
    },
    {
      key: "soldShapes",
      header: "Shapes Sold",
      render: (item) => {
        if (!item.soldShapes || item.soldShapes.length === 0) return "-";
        return (
          <div className="space-y-0.5">
            {item.soldShapes.map((s, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{s.shape}:</span>{" "}
                {s.pieces}pcs / {s.weight.toFixed(2)}ct
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "totalWeight",
      header: "Weight",
      render: (item) => `${(item.totalWeight || 0).toFixed(2)} ct`,
    },
    {
      key: "totalAmount",
      header: (
        <button
          onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          className="flex items-center gap-1"
        >
          Amount {sortDir === "asc" ? "\u2191" : "\u2193"}
        </button>
      ),
      render: (item) => (
        <span className="font-semibold">
          $ {(item.totalAmount || item.price || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (item) => (
        <div>
          <p className="text-sm font-medium">
            {item.customer?.name || item.buyer || "Walk-in"}
          </p>
          {item.customer?.phone && (
            <p className="text-xs text-muted-foreground">
              {item.customer.phone}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "soldDate",
      header: "Date",
      render: (item) =>
        new Date(item.soldAt || item.soldDate).toLocaleDateString("en-US"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex gap-1">
          {!item.cancelled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewInvoice(item._id || item.id)}
              title="View Invoice"
              className="h-8 w-8 text-blue-500 hover:text-blue-700"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
          {isAdmin && !item.cancelled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleUndo(item)}
              title="Undo Sale"
              className="h-8 w-8 text-orange-500 hover:text-orange-700"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          {item.cancelled && (
            <span title="Sale cancelled" className="p-2">
              <Ban className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout title="Sold Items">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <p className="text-muted-foreground text-sm">
              Track sales and manage transactions
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""
                  }`}
              />
              Refresh
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-1" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Bulk Invoice Button */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleGenerateInvoice}
              disabled={generatingInvoice}
              className="gap-1"
            >
              {generatingInvoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate Invoice ({selectedIds.length} sale{selectedIds.length > 1 ? "s" : ""})
            </Button>
            <span className="text-xs text-muted-foreground">
              Select sales to bundle into a single invoice
            </span>
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by sale ref, customer, invoice..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          {meta && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {meta.total} sales found
            </span>
          )}
        </div>

        {/* Table */}
        <div className="royal-card">
          <DataTable
            columns={columns}
            data={soldItems}
            loading={loading}
            keyExtractor={(item) => item._id || item.id}
            emptyMessage="No sales found"
          />

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Items per page:
              </span>
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

            <Pagination
              page={meta?.page || 1}
              totalPages={meta?.pages || 1}
              onChange={setPage}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
