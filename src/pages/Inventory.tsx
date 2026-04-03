import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Download,
  Upload,
  RotateCcw,
  FileDown,
  LayoutGrid,
  List,
  QrCode,
  ScanLine,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryCardView } from "@/components/inventory/InventoryCardView";
import { AddInventoryDialog } from "@/components/inventory/AddInventoryDialog";
import { QRScannerDialog } from "@/components/inventory/QRScannerDialog";
import { TallyScanningDialog } from "@/components/inventory/TallyScanningDialog";
import { InventoryItem, CUTTING_STYLES, CuttingStyleCode } from "@/types/inventory";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Pagination } from "@/components/common/Pagination";
import api from "@/services/api";
import { FilterCategorySelector } from "@/components/inventory/FilterCategorySelector";
import { FilterCuttingStyleSelector } from "@/components/inventory/FilterCuttingStyleSelector";
import { FilterSeriesSelector } from "@/components/inventory/FilterSeriesSelector";
import { FilterStatusSelector } from "@/components/inventory/FilterStatusSelector";
import { ShapeFilterSelector } from "@/components/inventory/ShapeFilterSelector";
import { LotTypeSelector } from "@/components/inventory/LotTypeSelector";

type ShapeName = string;

interface SeriesItem {
  _id: string;
  name: string;
}

export const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [shapeFilter, setShapeFilter] = useState<string>("ALL");
  const [cuttingStyleFilter, setCuttingStyleFilter] = useState("ALL");
  const [seriesFilter, setSeriesFilter] = useState("ALL");
  const [lotTypeFilter, setLotTypeFilter] = useState("ALL");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [minPieces, setMinPieces] = useState("");
  const [maxPieces, setMaxPieces] = useState("");
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [availableShapes, setAvailableShapes] = useState<ShapeName[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSeriesTallyOpen, setIsSeriesTallyOpen] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [selectedSeriesName, setSelectedSeriesName] = useState<string>("");

  // Fetch categories, shapes, series on mount
  useEffect(() => {
    fetchCategories();
    fetchAvailableShapes();
    fetchSeries();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.getCategories();
      if (response.success) {
        setCategories(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchAvailableShapes = async () => {
    try {
      const response = await api.getInventoryShapes();
      if (response.success && Array.isArray(response.data)) {
        setAvailableShapes(response.data);
      } else {
        setAvailableShapes([]);
      }
    } catch (error) {
      console.error("Error fetching shapes:", error);
      setAvailableShapes([]);
    }
  };

  const fetchSeries = async () => {
    try {
      const response = await api.getSeries({ limit: 100 });
      if (response.success) {
        setSeriesList(response.data);
      }
    } catch (error) {
      console.error("Error fetching series:", error);
    }
  };

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit,
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(categoryFilter !== "ALL" && { category: categoryFilter }),
        ...(statusFilter !== "All Status" && { status: statusFilter }),
        ...(shapeFilter !== "ALL" && { shape: shapeFilter }),
        ...(cuttingStyleFilter !== "ALL" && { cuttingStyle: cuttingStyleFilter }),
        ...(seriesFilter !== "ALL" && { series: seriesFilter }),
        ...(lotTypeFilter !== "ALL" && { lotType: lotTypeFilter }),
        ...(minWeight && { minWeight }),
        ...(maxWeight && { maxWeight }),
        ...(minPieces && { minPieces }),
        ...(maxPieces && { maxPieces }),
      };

      const response = await api.getInventory(params);
      setInventory(response.data);
      setTotalPages(response.meta?.totalPages || 1);
      setTotalItems(response.meta?.total || response.data?.length || 0);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  }, [
    page, limit, searchTerm, categoryFilter, statusFilter, shapeFilter,
    cuttingStyleFilter, seriesFilter, lotTypeFilter,
    minWeight, maxWeight, minPieces, maxPieces,
    sortBy, sortOrder
  ]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    categoryFilter, statusFilter, shapeFilter, searchTerm,
    cuttingStyleFilter, seriesFilter, lotTypeFilter,
    minWeight, maxWeight, minPieces, maxPieces
  ]);

  // Fetch inventory
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        // Third click: reset sort
        setSortBy('createdAt');
        setSortOrder('desc');
      }
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("ALL");
    setStatusFilter("All Status");
    setShapeFilter("ALL");
    setCuttingStyleFilter("ALL");
    setSeriesFilter("ALL");
    setLotTypeFilter("ALL");
    setMinWeight("");
    setMaxWeight("");
    setMinPieces("");
    setMaxPieces("");
    setSortBy("createdAt");
    setSortOrder("desc");
  };

  const hasActiveFilters =
    searchTerm || categoryFilter !== "ALL" || statusFilter !== "All Status" ||
    shapeFilter !== "ALL" || cuttingStyleFilter !== "ALL" || seriesFilter !== "ALL" ||
    lotTypeFilter !== "ALL" || minWeight || maxWeight || minPieces || maxPieces;

  // Build current filter params (shared between fetch and export)
  const getFilterParams = (): Record<string, any> => {
    const params: Record<string, any> = {};
    if (searchTerm) params.search = searchTerm;
    if (categoryFilter !== "ALL") params.category = categoryFilter;
    if (statusFilter !== "All Status") params.status = statusFilter;
    if (shapeFilter !== "ALL") params.shape = shapeFilter;
    if (cuttingStyleFilter !== "ALL") params.cuttingStyle = cuttingStyleFilter;
    if (seriesFilter !== "ALL") params.series = seriesFilter;
    if (lotTypeFilter !== "ALL") params.lotType = lotTypeFilter;
    if (minWeight) params.minWeight = minWeight;
    if (maxWeight) params.maxWeight = maxWeight;
    if (minPieces) params.minPieces = minPieces;
    if (maxPieces) params.maxPieces = maxPieces;
    params.sortBy = sortBy;
    params.sortOrder = sortOrder;
    return params;
  };

  const handleExport = async () => {
    try {
      await api.exportInventoryExcel(getFilterParams());
      toast.success(
        hasActiveFilters
          ? `Exported ${totalItems} filtered items`
          : "All inventory exported"
      );
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Failed to export inventory");
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await api.importInventoryCSV(file);
      if (response.success) {
        toast.success(response.data?.message || "CSV imported successfully");
        fetchInventory();
        fetchAvailableShapes();
      } else {
        toast.error(response.message || "Failed to import CSV");
      }
    } catch (error) {
      console.error("Error importing CSV:", error);
      toast.error("Failed to import CSV");
    }

    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  return (
    <MainLayout title="Inventory">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Inventory
          </h1>
          
          {/* Mobile Button Layout - Hidden on desktop */}
          <div className="sm:hidden inventory-actions-mobile space-y-2 w-full">
            {/* Row 1 - Add Item (full width, primary) */}
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
            
            {/* Row 2 - Export & Import */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleExport}
                className="border-input hover:bg-accent hover:text-accent-foreground h-10 text-sm"
                title="Export all inventory items"
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden xs:inline">Export</span>
              </Button>
              <Button
                variant="secondary"
                className="bg-secondary hover:bg-secondary/80 h-10 text-sm"
                onClick={() => csvInputRef.current?.click()}
                title="Import CSV file"
              >
                <Upload className="w-4 h-4 mr-1" />
                <span className="hidden xs:inline">Import</span>
              </Button>
            </div>
            
            {/* Row 3 - Excel+QR, Template, QR Labels */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const params = getFilterParams();
                    await api.exportInventoryExcelWithQR(params);
                    toast.success(hasActiveFilters ? `${totalItems} items exported` : "Exported with QR");
                  } catch {
                    toast.error("Failed to export");
                  }
                }}
                title="Excel with QR codes"
                className="h-10 text-xs p-1"
              >
                <QrCode className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await api.downloadCSVTemplate();
                    toast.success("Template downloaded");
                  } catch {
                    toast.error("Failed to download");
                  }
                }}
                title="Download CSV template"
                className="h-10 text-xs p-1"
              >
                <FileDown className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const params = getFilterParams();
                    await api.downloadQRLabelsPDF(params);
                    toast.success("QR labels downloaded");
                  } catch {
                    toast.error("Failed to download");
                  }
                }}
                title="Download QR labels PDF"
                className="h-10 text-xs p-1"
              >
                <QrCode className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Row 4 - Scan & Series Tally */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsScannerOpen(true)}
                title="Scan QR code"
                className="h-10 text-sm"
              >
                <ScanLine className="w-4 h-4 mr-1" />
                Scan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (seriesList.length === 0) {
                    toast.error("No series available");
                    return;
                  }
                  if (seriesList.length === 1) {
                    setSelectedSeriesId(seriesList[0]._id);
                    setSelectedSeriesName(seriesList[0].name);
                    setIsSeriesTallyOpen(true);
                  } else {
                    setIsSeriesTallyOpen(true);
                  }
                }}
                title="Series Tally"
                className="h-10 text-sm"
              >
                <Pill className="w-4 h-4 mr-1" />
                Tally
              </Button>
            </div>
          </div>

          {/* Hidden CSV Input */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
            aria-label="Import CSV file"
          />

          {/* Desktop Button Layout - Hidden on mobile */}
          <div className="hidden sm:flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-input hover:bg-accent hover:text-accent-foreground"
              title="Export all inventory items as Excel spreadsheet"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel{hasActiveFilters ? ` (${totalItems} items)` : ''}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const params = getFilterParams();
                  await api.exportInventoryExcelWithQR(params);
                  toast.success(
                    hasActiveFilters
                      ? `Exported ${totalItems} items with QR codes`
                      : "All inventory exported with QR codes"
                  );
                } catch {
                  toast.error("Failed to export with QR codes");
                }
              }}
              title="Export inventory with embedded QR codes"
            >
              <QrCode className="w-4 h-4 mr-1" />
              Excel + QR
            </Button>
            <Button
              variant="secondary"
              className="bg-secondary hover:bg-secondary/80"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await api.downloadCSVTemplate();
                  toast.success("Template downloaded");
                } catch {
                  toast.error("Failed to download template");
                }
              }}
              title="Download CSV template with correct headers"
            >
              <FileDown className="w-4 h-4 mr-1" />
              Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const params = getFilterParams();
                  await api.downloadQRLabelsPDF(params);
                  toast.success("QR labels PDF downloaded");
                } catch {
                  toast.error("Failed to download QR labels");
                }
              }}
              title="Download QR code labels PDF for current items"
            >
              <QrCode className="w-4 h-4 mr-1" />
              QR Labels
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              title="Scan QR code to find an item"
            >
              <ScanLine className="w-4 h-4 mr-1" />
              Scan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (seriesList.length === 0) {
                  toast.error("No series available");
                  return;
                }
                if (seriesList.length === 1) {
                  setSelectedSeriesId(seriesList[0]._id);
                  setSelectedSeriesName(seriesList[0].name);
                  setIsSeriesTallyOpen(true);
                } else {
                  // Show series selection dialog
                  setIsSeriesTallyOpen(true);
                }
              }}
              title="Start series tally and inventory scan"
            >
              <Pill className="w-4 h-4 mr-1" />
              Series Tally
            </Button>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search across all fields (serial, code, category, shape, series, cutting style...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-none"
              title="Table view"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-none"
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-red-600 hover:text-red-700"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
            {/* Dropdown Filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Category Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <FilterCategorySelector
                  categories={categories}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  placeholder="All Categories"
                />
              </div>

              {/* Shape Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Shape</label>
                <ShapeFilterSelector
                  shapes={availableShapes}
                  value={shapeFilter}
                  onChange={setShapeFilter}
                  placeholder="All Shapes"
                />
              </div>

              {/* Cutting Style Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cutting Style</label>
                <FilterCuttingStyleSelector
                  value={cuttingStyleFilter}
                  onChange={setCuttingStyleFilter}
                  placeholder="All Styles"
                />
              </div>

              {/* Series Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Series</label>
                <FilterSeriesSelector
                  series={seriesList}
                  value={seriesFilter}
                  onChange={setSeriesFilter}
                  placeholder="All Series"
                />
              </div>

              {/* Lot Type Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lot Type</label>
                <LotTypeSelector
                  value={lotTypeFilter}
                  onChange={setLotTypeFilter}
                  placeholder="All Types"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <FilterStatusSelector
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="All Status"
                />
              </div>
            </div>

            {/* Range Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Weight</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={minWeight}
                  onChange={(e) => setMinWeight(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Weight</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={maxWeight}
                  onChange={(e) => setMaxWeight(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Pieces</label>
                <Input
                  type="number"
                  step="1"
                  placeholder="Min"
                  value={minPieces}
                  onChange={(e) => setMinPieces(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Pieces</label>
                <Input
                  type="number"
                  step="1"
                  placeholder="Max"
                  value={maxPieces}
                  onChange={(e) => setMaxPieces(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-10 text-center text-muted-foreground">
            Loading inventory...
          </div>
        )}

        {/* Empty state */}
        {!loading && inventory.length === 0 && (
          <div className="text-center text-muted-foreground mt-10">
            No inventory items match your filters
          </div>
        )}

        {/* Table / Card View */}
        {inventory.length > 0 && viewMode === 'table' && (
          <InventoryTable
            inventory={inventory}
            loading={loading}
            onRefresh={() => {
              fetchInventory();
              fetchAvailableShapes();
              fetchSeries();
            }}
            categories={categories}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        )}

        {inventory.length > 0 && viewMode === 'card' && (
          <InventoryCardView
            inventory={inventory}
            loading={loading}
            onRefresh={() => {
              fetchInventory();
              fetchAvailableShapes();
              fetchSeries();
            }}
            categories={categories}
          />
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t rounded-b-lg bg-card">
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

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(p) => setPage(p)}
            />
          )}
        </div>

        {/* Add Inventory Dialog */}
        <AddInventoryDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSuccess={() => {
            fetchInventory();
            fetchCategories();
            fetchAvailableShapes();
            fetchSeries();
          }}
          categories={categories}
        />

        <QRScannerDialog
          open={isScannerOpen}
          onOpenChange={setIsScannerOpen}
        />

        {/* Series Tally Dialog */}
        {selectedSeriesId && (
          <TallyScanningDialog
            open={isSeriesTallyOpen}
            onOpenChange={(open) => {
              setIsSeriesTallyOpen(open);
              if (!open) {
                setSelectedSeriesId(null);
                setSelectedSeriesName("");
              }
            }}
            seriesId={selectedSeriesId}
            seriesName={selectedSeriesName}
          />
        )}

        {/* Series Selection Dialog (when no series selected but tally open) */}
        {!selectedSeriesId && isSeriesTallyOpen && seriesList.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-950 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold mb-4">Select Series for Tally</h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {seriesList.map((series) => (
                  <button
                    key={series._id}
                    onClick={() => {
                      setSelectedSeriesId(series._id);
                      setSelectedSeriesName(series.name);
                    }}
                    className="w-full text-left p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                  >
                    <div className="font-medium">{series.name}</div>
                    <div className="text-sm text-muted-foreground">{series._id}</div>
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setIsSeriesTallyOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Inventory;
