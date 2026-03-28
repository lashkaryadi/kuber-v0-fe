import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import api from "@/services/api";
import { toast } from "@/hooks/use-toast";

interface PackagingItem {
  inventory: {
    id: string;
    serialNumber: string;
    category: { name: string };
    weight: number;
    weightUnit: string;
    pieces: number;
    purchaseCode?: string;
    saleCode?: string;
  };
}

interface Packaging {
  id: string;
  clientName: string;
  createdAt: string;
  items: PackagingItem[];
}

export default function PackagingDetails() {
  const { id } = useParams(); // packagingId
  const navigate = useNavigate();

  const [packaging, setPackaging] = useState<Packaging | null>(null);
  const [keptItemIds, setKeptItemIds] = useState<string[]>([]);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  /* ---------------- FETCH PACKAGING ---------------- */
  useEffect(() => {
    const fetchPackaging = async () => {
      try {
        const data = await api.getPackagingById(id!);
        setPackaging(data);

        // default: all items kept
        setKeptItemIds(data.items.map((i: PackagingItem) => i.inventory.id));
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load packaging",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPackaging();
  }, [id]);

  /* ---------------- CALCULATIONS ---------------- */
  const keptItems =
    packaging?.items.filter((i) => keptItemIds.includes(i.inventory.id)) || [];

  const totalWeight = keptItems.reduce((sum, i) => sum + i.inventory.weight, 0);

  const totalPieces = keptItems.reduce((sum, i) => sum + i.inventory.pieces, 0);

  const totalAmount = totalWeight * pricePerUnit;

  /* ---------------- ACTIONS ---------------- */
  const toggleItem = (itemId: string) => {
    setKeptItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleGenerateInvoice = async () => {
    if (keptItemIds.length === 0) {
      toast({
        title: "No items selected",
        description: "All items will be returned. Invoice not generated.",
      });
      return;
    }

    if (!pricePerUnit || pricePerUnit <= 0) {
      toast({
        title: "Price required",
        description: "Enter valid price per unit",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      const invoice = await api.generateInvoice({
        packagingId: packaging!.id,
        keptItemIds,
        pricePerUnit,
      });

      toast({
        title: "Invoice created",
        description: "Redirecting to invoice",
      });

      navigate(`/invoices/${invoice.id}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.message || "Failed to generate invoice",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  /* ---------------- UI ---------------- */
  if (loading) {
    return (
      <MainLayout title="Packaging">
        <p>Loading...</p>
      </MainLayout>
    );
  }

  if (!packaging) return null;

  return (
    <MainLayout title="Packaging Details">
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* HEADER */}
        <div className="bg-card/50 p-6 rounded-xl border border-border/50 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-serif font-bold text-primary">
                {packaging.clientName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Created on {new Date(packaging.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </p>
            </div>
            <div className="px-4 py-1.5 bg-primary/10 rounded-full text-primary text-sm font-medium border border-primary/20">
              {packaging.items.length} Items
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ITEMS LIST */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-1 h-6 bg-primary rounded-full"></span>
              Items in Lot
            </h3>
            <div className="royal-card p-0 overflow-hidden">
              <div className="divide-y divide-border">
                {packaging.items.map((item) => {
                  const inv = item.inventory;
                  const checked = keptItemIds.includes(inv.id);

                  return (
                    <div
                      key={inv.id}
                      className={`flex items-start gap-4 p-4 transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleItem(inv.id)}
                        className="mt-1"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-foreground truncate">{inv.serialNumber}</p>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {inv.pieces} pcs
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground mt-0.5">
                          {typeof inv.category === "object" ? inv.category.name : "Deleted"}
                          <span className="mx-2 text-border">|</span>
                          {inv.weight} {inv.weightUnit}
                        </p>

                        {(inv.purchaseCode || inv.saleCode) && (
                          <div className="flex gap-2 mt-2">
                            {inv.purchaseCode && (
                              <span className="text-[10px] uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                PC: {inv.purchaseCode}
                              </span>
                            )}
                            {inv.saleCode && (
                              <span className="text-[10px] uppercase tracking-wider bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                                SC: {inv.saleCode}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SIDEBAR / BILLING */}
          <div className="lg:col-span-1 space-y-6">
            <div className="royal-card sticky top-6">
              <h3 className="font-serif text-xl font-semibold mb-4 text-center border-b pb-3">Invoice Generation</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="pricePerUnit" className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Price per Carat / Unit
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <input
                      id="pricePerUnit"
                      type="number"
                      className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(Number(e.target.value))}
                      min={0}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Selected Items</span>
                    <span className="font-medium text-foreground">{keptItems.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Weight</span>
                    <span className="font-medium text-foreground">{(totalWeight || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Pieces</span>
                    <span className="font-medium text-foreground">{totalPieces}</span>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-foreground">Total Amount</span>
                    <span className="font-serif text-lg font-bold text-primary">₹ {totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateInvoice}
                  disabled={generating || keptItems.length === 0}
                  className="w-full h-12 text-base shadow-md hover:shadow-lg transition-all"
                >
                  {generating ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Generating Invoice...
                    </>
                  ) : (
                    "Generate & View Invoice"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
