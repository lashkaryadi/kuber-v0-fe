import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InventoryItem } from '@/types/inventory';
import { toast } from 'sonner';
import api from '@/services/api';
import { Loader2 } from 'lucide-react';

interface SellShape {
  shape: string;
  availablePieces: number;
  availableWeight: number;
  sellPieces: number;
  sellWeight: number;
  pricePerCarat: number;
  selected: boolean;
}

interface SellInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  onSuccess: () => void;
}

export const SellInventoryDialog: React.FC<SellInventoryDialogProps> = ({
  open,
  onOpenChange,
  item,
  onSuccess
}) => {
  const [sellShapes, setSellShapes] = useState<SellShape[]>([]);
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lines, setLines] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize sell shapes based on item type
  useEffect(() => {
    if (open && item) {
      setLines(item.lines !== undefined && item.lines !== null ? String(item.lines) : '');
      setGrossWeight(item.grossWeight !== undefined && item.grossWeight !== null ? String(item.grossWeight) : '');

      if (item.shapeType === 'single') {
        // Single shape item
        const pricePerCarat = getPricePerCarat(item.saleCode);
        setSellShapes([{
          shape: item.singleShape || 'Unknown',
          availablePieces: item.availablePieces || 0,
          availableWeight: item.availableWeight || 0,
          sellPieces: item.availablePieces || 0,
          sellWeight: item.availableWeight || 0,
          pricePerCarat: pricePerCarat,
          selected: true
        }]);
      } else if (item.shapeType === 'mix' && item.shapes && item.shapes.length > 0) {
        // Mix shape item
        const pricePerCarat = getPricePerCarat(item.saleCode);
        setSellShapes(item.shapes.map(shape => ({
          shape: shape.shape,
          availablePieces: shape.pieces,
          availableWeight: shape.weight,
          sellPieces: shape.pieces,
          sellWeight: shape.weight,
          pricePerCarat: pricePerCarat,
          selected: true
        })));
      }
    }
  }, [open, item]);

  const getPricePerCarat = (saleCode: string): number => {
    if (!saleCode) return 0;
    const price = parseFloat(saleCode);
    return !isNaN(price) && isFinite(price) ? price : 0;
  };

  const handleShapeSelection = (index: number, selected: boolean) => {
    setSellShapes(prev => prev.map((shape, i) =>
      i === index ? { ...shape, selected } : shape
    ));
  };

  const handlePiecesChange = (index: number, value: string) => {
    // START MANUAL ENTRY UPDATE: Allow manual entry
    const pieces = value === '' ? 0 : parseInt(value);

    setSellShapes(prev => prev.map((shape, i) => {
      if (i === index) {
        // Validation only - don't auto-calculate weight
        const validPieces = isNaN(pieces) ? 0 : pieces;

        return {
          ...shape,
          sellPieces: validPieces // Allow user to exceed available for now, validate on submit/blur or just show error
        };
      }
      return shape;
    }));
  };

  const handleWeightChange = (index: number, value: string) => {
    // START MANUAL ENTRY UPDATE: Allow manual entry
    const weight = value === '' ? 0 : parseFloat(value);

    setSellShapes(prev => prev.map((shape, i) => {
      if (i === index) {
        // Validation only - don't auto-calculate pieces
        const validWeight = isNaN(weight) ? 0 : weight;

        return {
          ...shape,
          sellWeight: validWeight
        };
      }
      return shape;
    }));
  };

  const handlePriceChange = (index: number, value: string) => {
    const price = parseFloat(value) || 0;
    setSellShapes(prev => prev.map((shape, i) =>
      i === index ? { ...shape, pricePerCarat: price } : shape
    ));
  };

  const getTotalSold = () => {
    return sellShapes
      .filter(shape => shape.selected)
      .reduce((total, shape) => ({
        pieces: total.pieces + shape.sellPieces,
        weight: total.weight + shape.sellWeight,
        amount: total.amount + (shape.sellWeight * shape.pricePerCarat)
      }), { pieces: 0, weight: 0, amount: 0 });
  };

  const validateInputs = (): boolean => {
    // At least one shape must be selected
    const hasSelected = sellShapes.some(shape => shape.selected);
    if (!hasSelected) {
      toast.error('Please select at least one shape to sell');
      return false;
    }

    // Validate each selected shape
    for (const shape of sellShapes) {
      if (shape.selected) {
        // Convert empty/zero values
        const piecesToSell = shape.sellPieces || 0;
        const weightToSell = shape.sellWeight || 0;

        // At least one of pieces or weight must be > 0
        if (piecesToSell <= 0 && weightToSell <= 0) {
          toast.error(`Please enter either pieces or weight for ${shape.shape}`);
          return false;
        }

        // If pieces are provided, validate against available
        if (piecesToSell > 0 && piecesToSell > shape.availablePieces) {
          toast.error(`Cannot sell ${piecesToSell} pieces of ${shape.shape} - only ${shape.availablePieces} available`);
          return false;
        }
        
        // If weight is provided, validate against available
        if (weightToSell > 0 && weightToSell > shape.availableWeight) {
          toast.error(`Cannot sell ${weightToSell.toFixed(2)} ct of ${shape.shape} - only ${shape.availableWeight.toFixed(2)} ct available`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) return;

    setLoading(true);

    try {
      const selectedShapes = sellShapes
        .filter(shape => shape.selected && (shape.sellPieces > 0 || shape.sellWeight > 0)) // Allow either pieces or weight
        .map(shape => ({
          shape: shape.shape,
          pieces: shape.sellPieces,
          weight: shape.sellWeight,
          pricePerCarat: shape.pricePerCarat,
          lineTotal: shape.sellWeight * shape.pricePerCarat
        }));

      const parsedLines = lines.trim() === '' ? null : Number.parseInt(lines, 10);
      const parsedGrossWeight = grossWeight.trim() === '' ? null : Number.parseFloat(grossWeight);

      const normalizedLines = Number.isInteger(parsedLines) && parsedLines >= 0 ? parsedLines : null;
      const normalizedGrossWeight = Number.isFinite(parsedGrossWeight) && (parsedGrossWeight ?? -1) >= 0
        ? parsedGrossWeight
        : null;

      const response = await api.sellInventoryItem({
        inventoryId: item._id,
        soldShapes: selectedShapes,
        customer: {
          name: customer.name || undefined,
          email: customer.email || undefined,
          phone: customer.phone || undefined
        },
        invoiceNumber: invoiceNumber || undefined,
        lines: normalizedLines,
        grossWeight: normalizedGrossWeight
      });

      if (response.success) {
        toast.success('Sale completed successfully');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to complete sale');
      }
    } catch (error: unknown) {
      console.error('Error selling item:', error);
      const err = error as any;
      toast.error(err?.response?.data?.message || 'Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  const totalSold = getTotalSold();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Inventory — {item.serialNumber}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Item Info */}
          <div className="p-3 bg-muted/50 rounded-md border">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category: </span>
                <span className="font-medium">{item.category?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Shape Type: </span>
                <span className="font-medium capitalize">{item.shapeType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location: </span>
                <span className="font-medium">{item.location || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Shape Selection */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Select Shapes to Sell</h3>

            {sellShapes.map((shape, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${shape.selected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    id={`shape-${index}`}
                    checked={shape.selected}
                    onCheckedChange={(checked) => handleShapeSelection(index, !!checked)}
                    disabled={sellShapes.length === 1} // Disable checkbox if only one shape (auto-selected)
                    className="mt-1"
                  />

                  <div className="flex-1 space-y-3">
                    <Label className="text-base font-medium">
                      {shape.shape}
                    </Label>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <Label htmlFor={`pieces-${index}`} className="text-xs text-muted-foreground">
                          Pieces <span className="text-xs text-gray-400">(Optional - Available: {shape.availablePieces})</span>
                        </Label>
                        <Input
                          id={`pieces-${index}`}
                          type="number"
                          min="0"
                          max={shape.availablePieces}
                          placeholder="0"
                          value={shape.selected ? shape.sellPieces : ''}
                          onChange={(e) => handlePiecesChange(index, e.target.value)}
                          disabled={!shape.selected}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`weight-${index}`} className="text-xs text-muted-foreground">
                          Weight (Required - Available: {shape.availableWeight.toFixed(2)} ct)
                        </Label>
                        <Input
                          id={`weight-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max={shape.availableWeight}
                          placeholder="0.00"
                          value={shape.selected ? shape.sellWeight : ''}
                          onChange={(e) => handleWeightChange(index, e.target.value)}
                          disabled={!shape.selected}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`price-${index}`} className="text-xs text-muted-foreground">
                          Price per Carat
                        </Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={shape.pricePerCarat}
                          onChange={(e) => handlePriceChange(index, e.target.value)}
                          disabled={!shape.selected}
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Line Total
                        </Label>
                        <div className="h-10 flex items-center px-3 border rounded-md bg-muted">
                          <span className="font-medium">
                            ${(shape.sellWeight * shape.pricePerCarat).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
            <h4 className="font-medium mb-3">Sale Summary</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Total Pieces:</span>
                <p className="text-xl font-bold">{totalSold.pieces}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total Weight:</span>
                <p className="text-xl font-bold">{totalSold.weight.toFixed(2)} ct</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total Amount:</span>
                <p className="text-xl font-bold text-green-600">${totalSold.amount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Optional Metrics */}
          <div className="space-y-4">
            <h4 className="font-medium">Lines & Gross Weight (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lines">Lines</Label>
                <Input
                  id="lines"
                  type="number"
                  min="0"
                  step="1"
                  value={lines}
                  onChange={(e) => setLines(e.target.value)}
                  placeholder="Enter line count"
                />
              </div>
              <div>
                <Label htmlFor="grossWeight">Gross Weight</Label>
                <Input
                  id="grossWeight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  placeholder="Enter gross weight"
                />
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <h4 className="font-medium">Customer Information (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={customer.name}
                  onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => setCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || (totalSold.pieces === 0 && totalSold.weight === 0)}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Processing...' : 'Complete Sale'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};