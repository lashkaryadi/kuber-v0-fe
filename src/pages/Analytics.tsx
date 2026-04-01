import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import api from "@/services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Weight,
  Layers,
  Download,
  ShoppingCart,
  Loader2,
} from "lucide-react";

interface AnalyticsData {
  totals: {
    revenue: number;
    totalWeight: number;
    totalPieces: number;
    count: number;
  };
  monthly: Array<{
    month: string;
    revenue: number;
    count: number;
    weight: number;
  }>;
  categories: Array<{
    _id: string;
    revenue: number;
    count: number;
    weight: number;
  }>;
  customers: Array<{
    _id: string;
    revenue: number;
    count: number;
  }>;
  inventoryStats: Array<{
    _id: string;
    count: number;
    totalWeight: number;
    totalPieces: number;
  }>;
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.getAnalytics();
        if (response.success) {
          setData(response.data);
        } else {
          toast({
            title: "Error",
            description: "Failed to load analytics",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load analytics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleExport = async () => {
    const result = await api.exportProfitExcel();
    if (result.success) {
      toast({ title: "Success", description: "Report exported to Excel" });
    } else {
      toast({
        title: "Error",
        description: "Failed to export",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <MainLayout title="Analytics">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout title="Analytics">
        <p className="text-muted-foreground p-6">No analytics data available.</p>
      </MainLayout>
    );
  }

  // Inventory pie chart data
  const inventoryPieData = (data.inventoryStats || []).map((stat) => ({
    name: stat._id === "in_stock" ? "In Stock" :
      stat._id === "sold" ? "Sold" :
        stat._id === "partially_sold" ? "Partially Sold" :
          stat._id === "pending" ? "Pending" : stat._id,
    value: stat.count,
  }));

  return (
    <MainLayout title="Analytics">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
              Sales performance and inventory analytics
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                $ {(data.totals.revenue || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {data.totals.count || 0} sales
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sales
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.totals.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Weight Sold
              </CardTitle>
              <Weight className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data.totals.totalWeight || 0).toFixed(2)} ct
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pieces Sold
              </CardTitle>
              <Layers className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data.totals.totalPieces || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
              <CardDescription>Sales revenue trend over time</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {data.monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [
                        `$ ${value.toLocaleString()}`,
                        "Revenue",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No monthly data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Category</CardTitle>
              <CardDescription>Top performing gem categories</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {data.categories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categories}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [
                        `$ ${value.toLocaleString()}`,
                        "Revenue",
                      ]}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No category data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory Status */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Status</CardTitle>
              <CardDescription>Current inventory distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {inventoryPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {inventoryPieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No inventory data
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
              <CardDescription>Highest revenue customers</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {data.customers.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.customers.map((c) => ({
                      ...c,
                      name: c._id || "Walk-in",
                    }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `$ ${value.toLocaleString()}`,
                        "Revenue",
                      ]}
                    />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No customer data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
