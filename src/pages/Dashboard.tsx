import { useEffect, useState, useCallback } from "react";
import {
  Package,
  CheckCircle,
  ShoppingCart,
  Clock,
  TrendingUp,
  Weight,
  Layers,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/common/StatCard";
import { LoadingPage } from "@/components/common/LoadingSpinner";
import { DataTable, Column } from "@/components/common/DataTable";
import { useAuth } from "@/contexts/AuthContext";
import api, { DashboardStats, SoldItem } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const REFRESH_INTERVAL = 30000; // 30 seconds auto-refresh

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchDashboardData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const response = await api.getDashboardStats();

    if (!response.success) {
      toast({
        title: "Error",
        description: response.error || "Failed to fetch dashboard stats",
        variant: "destructive",
      });
      setStats({
        totalInventory: 0,
        in_stockItems: 0,
        partiallySoldItems: 0,
        soldItems: 0,
        pendingApproval: 0,
        totalValue: 0,
        totalWeight: 0,
        totalPieces: 0,
        totalSalesAmount: 0,
        inStockValue: "-",
        recentSales: [],
      });
    } else if (response.data) {
      setStats(response.data);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Refresh dashboard after any desktop data mutation.
  useEffect(() => {
    const handleDataChanged = () => {
      fetchDashboardData(true);
    };

    window.addEventListener("kuber-data-changed", handleDataChanged);
    return () => window.removeEventListener("kuber-data-changed", handleDataChanged);
  }, [fetchDashboardData]);

  const recentSalesColumns: Column<SoldItem>[] = [
    {
      key: "saleRef",
      header: "Ref #",
      render: (item) => (
        <span className="font-mono text-sm text-muted-foreground">
          {item.saleRef || item.invoiceNumber || "-"}
        </span>
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
      render: (item) => item.inventoryItem?.category?.name || "-",
    },
    {
      key: "customer",
      header: "Customer",
      render: (item) => item.customer?.name || item.buyer || "Walk-in",
    },
    {
      key: "amount",
      header: "Amount",
      render: (item) => (
        <span className="font-semibold">
          $ {(item.totalAmount || item.price || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "soldDate",
      header: "Date",
      render: (item) =>
        new Date(item.soldAt || item.soldDate).toLocaleDateString("en-US"),
    },
  ];

  if (loading) {
    return (
      <MainLayout title="Dashboard">
        <LoadingPage />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-4 sm:space-y-6">
        {/* Header with refresh */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Real-time overview of your inventory
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid - Row 1: Item counts */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            title="Total Inventory"
            value={stats?.totalInventory || 0}
            icon={Package}
            variant="primary"
          />
          <StatCard
            title="In Stock"
            value={stats?.in_stockItems || 0}
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Partially Sold"
            value={stats?.partiallySoldItems || 0}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="Fully Sold"
            value={stats?.soldItems || 0}
            icon={ShoppingCart}
            variant="default"
          />
          <StatCard
            title="Pending"
            value={stats?.pendingApproval || 0}
            icon={Clock}
            variant="warning"
          />
        </div>

        {/* Stats Grid - Row 2: Weight, Pieces, Values (Admin only for values) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="royal-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Available Weight
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {(stats?.totalWeight || 0).toLocaleString()} ct
              </p>
            </CardContent>
          </Card>

          <Card className="royal-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Available Pieces
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {(stats?.totalPieces || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {user?.role === "admin" && (
            <>
              <Card className="royal-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      In-Stock Value
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {stats?.inStockValue === "-"
                      ? "-"
                      : `$ ${Number(stats?.inStockValue || 0).toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on sale code x weight
                  </p>
                </CardContent>
              </Card>

              <Card className="royal-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-orange-500" />
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Sales
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-600">
                    $ {(stats?.totalSalesAmount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All completed sales
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Recent Sales */}
        <Card className="royal-card">
          <CardHeader>
            <CardTitle className="font-serif text-base sm:text-lg">
              Recent Sales
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Latest transactions from your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={recentSalesColumns}
              data={stats?.recentSales || []}
              keyExtractor={(item) => item.id || item._id}
              emptyMessage="No recent sales"
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
