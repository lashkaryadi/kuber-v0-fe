import React, { useState } from 'react';
import { Edit, Trash2, ShoppingCart, Merge, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem, Category, CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';
import { AddInventoryDialog } from './AddInventoryDialog';
import { SellInventoryDialog } from './SellInventoryDialog';
import { MergePacketDialog } from './MergePacketDialog';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryTableProps {
  inventory: InventoryItem[];
  loading: boolean;
  onRefresh: () => void;
  categories?: Category[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  inventory,
  loading,
  onRefresh,
  categories = [],
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onSort
}) => {
  const { user } = useAuth();
  const [editItem, setEditItem] = useState<InventoryItem | undefined>();
  const [saleItem, setSaleItem] = useState<InventoryItem | undefined>();
  const [mergeItem, setMergeItem] = useState<InventoryItem | undefined>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const handleDelete = async (item: InventoryItem) => {
    if (!isAdmin) {
      toast.error('Only admins can delete inventory items');
      return;
    }

    if (!confirm(`Are you sure you want to delete item ${item.serialNumber}?`)) {
      return;
    }

    setDeletingId(item._id);

    try {
      const response = await api.deleteInventoryItem(item._id);

      if (response.success) {
        toast.success('Item moved to recycle bin');
        onRefresh();
      } else {
        toast.error(response.message || 'Failed to delete item');
      }
    } catch (error: unknown) {
      console.error('Error deleting item:', error);
      const err = error as any;
      toast.error(err?.response?.data?.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const normalizeStatus = (status?: string) => {
    if (!status) return '';
    return String(status).trim().toLowerCase().replace(/\s+/g, '_');
  };

  const getStatusBadge = (item: InventoryItem) => {
    const normalizedStatus = normalizeStatus(item.status);

    if (normalizedStatus === 'in_stock') {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
          In Stock
        </Badge>
      );
    }

    if (normalizedStatus === 'pending') {
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
          Pending
        </Badge>
      );
    }

    if (normalizedStatus === 'partially_sold') {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
          Partially Sold
        </Badge>
      );
    }

    if (normalizedStatus === 'sold') {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
          Sold
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
        -
      </Badge>
    );
  };

  const renderShapes = (item: InventoryItem) => {
    if (item.shapeType === 'single') {
      return (
        <Badge variant="outline" className="text-xs">
          {item.singleShape}
        </Badge>
      );
    }

    if (item.shapeType === 'mix' && item.shapes && item.shapes.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {item.shapes.slice(0, 2).map((shape) => (
            <Badge key={`${item._id}-${shape.shape}`} variant="outline" className="text-xs">
              {shape.shape}
            </Badge>
          ))}
          {item.shapes.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{item.shapes.length - 2}
            </Badge>
          )}
        </div>
      );
    }

    return <span className="text-muted-foreground text-sm">N/A</span>;
  };

  const parseDimensionNumber = (value: unknown) => {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseDimensionString = (value: unknown) => {
    if (typeof value !== 'string') return undefined;

    const match = value.trim().match(/([0-9]*\.?[0-9]+)\s*[xX]\s*([0-9]*\.?[0-9]+)/);
    if (!match) return undefined;

    return {
      length: parseDimensionNumber(match[1]),
      width: parseDimensionNumber(match[2])
    };
  };

  const normalizeDimensionPoint = (value: any) => {
    if (value === undefined || value === null) return undefined;

    if (typeof value === 'string') {
      return parseDimensionString(value);
    }

    if (typeof value !== 'object') {
      return undefined;
    }

    const length = parseDimensionNumber(value.length ?? value.l ?? value.len ?? value.dimensionLength);
    const width = parseDimensionNumber(value.width ?? value.w ?? value.wid ?? value.dimensionWidth);

    if (length <= 0 && width <= 0) {
      return undefined;
    }

    return { length, width };
  };

  const pickDimensionPoint = (
    source: any,
    options: { objectKeys?: string[]; lengthKeys?: string[]; widthKeys?: string[] } = {}
  ) => {
    const { objectKeys = [], lengthKeys = [], widthKeys = [] } = options;

    for (const key of objectKeys) {
      const point = normalizeDimensionPoint(source?.[key]);
      if (point) return point;
    }

    let length: number | null = null;
    let width: number | null = null;

    for (const key of lengthKeys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        length = parseDimensionNumber(value);
        break;
      }
    }

    for (const key of widthKeys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        width = parseDimensionNumber(value);
        break;
      }
    }

    const normalizedLength = length ?? 0;
    const normalizedWidth = width ?? 0;

    if (normalizedLength <= 0 && normalizedWidth <= 0) {
      return undefined;
    }

    return {
      length: normalizedLength,
      width: normalizedWidth
    };
  };

  const formatDimensionPoint = (point?: { length?: number; width?: number }) => {
    const length = parseDimensionNumber(point?.length);
    const width = parseDimensionNumber(point?.width);

    if (length <= 0 && width <= 0) {
      return null;
    }

    return `${length}x${width}`;
  };

  const getMixDimensionBounds = (item: InventoryItem) => {
    let minLength = Infinity;
    let minWidth = Infinity;
    let maxLength = 0;
    let maxWidth = 0;
    let hasMin = false;
    let hasMax = false;

    for (const shape of item.shapes || []) {
      const minPoint = pickDimensionPoint(shape as any, {
        objectKeys: ['dimensionMin', 'dimMin', 'dim_min', 'minDimension', 'min_dimension'],
        lengthKeys: ['dimensionMinLength', 'dimMinLength', 'dim_min_length', 'minLength', 'min_length'],
        widthKeys: ['dimensionMinWidth', 'dimMinWidth', 'dim_min_width', 'minWidth', 'min_width']
      });
      const maxPoint = pickDimensionPoint(shape as any, {
        objectKeys: ['dimensionMax', 'dimMax', 'dim_max', 'maxDimension', 'max_dimension'],
        lengthKeys: ['dimensionMaxLength', 'dimMaxLength', 'dim_max_length', 'maxLength', 'max_length'],
        widthKeys: ['dimensionMaxWidth', 'dimMaxWidth', 'dim_max_width', 'maxWidth', 'max_width']
      });

      const minLen = parseDimensionNumber(minPoint?.length);
      const minWid = parseDimensionNumber(minPoint?.width);
      const maxLen = parseDimensionNumber(maxPoint?.length);
      const maxWid = parseDimensionNumber(maxPoint?.width);

      if (minLen > 0 || minWid > 0) {
        hasMin = true;
        if (minLen > 0) minLength = Math.min(minLength, minLen);
        if (minWid > 0) minWidth = Math.min(minWidth, minWid);
      }

      if (maxLen > 0 || maxWid > 0) {
        hasMax = true;
        if (maxLen > 0) maxLength = Math.max(maxLength, maxLen);
        if (maxWid > 0) maxWidth = Math.max(maxWidth, maxWid);
      }
    }

    return {
      min: hasMin
        ? {
            length: Number.isFinite(minLength) ? minLength : 0,
            width: Number.isFinite(minWidth) ? minWidth : 0
          }
        : undefined,
      max: hasMax ? { length: maxLength, width: maxWidth } : undefined
    };
  };

  const formatDimensions = (item: InventoryItem) => {
    const itemAny = item as any;
    const legacyPoint = normalizeDimensionPoint(itemAny.dimensions);

    let min =
      pickDimensionPoint(itemAny, {
        objectKeys: ['dimMin', 'dim_min', 'dimensionMin', 'dimension_min', 'minDimension', 'min_dimension'],
        lengthKeys: ['dimMinLength', 'dim_min_length', 'dimensionMinLength', 'minLength', 'min_length'],
        widthKeys: ['dimMinWidth', 'dim_min_width', 'dimensionMinWidth', 'minWidth', 'min_width']
      }) ||
      normalizeDimensionPoint(item.dimensions?.min) ||
      legacyPoint;

    let max =
      pickDimensionPoint(itemAny, {
        objectKeys: ['dimMax', 'dim_max', 'dimensionMax', 'dimension_max', 'maxDimension', 'max_dimension'],
        lengthKeys: ['dimMaxLength', 'dim_max_length', 'dimensionMaxLength', 'maxLength', 'max_length'],
        widthKeys: ['dimMaxWidth', 'dim_max_width', 'dimensionMaxWidth', 'maxWidth', 'max_width']
      }) ||
      normalizeDimensionPoint(item.dimensions?.max) ||
      legacyPoint;

    if (item.shapeType === 'mix' && item.shapes && item.shapes.length > 0) {
      const mixBounds = getMixDimensionBounds(item);
      if (mixBounds.min || mixBounds.max) {
        min = mixBounds.min;
        max = mixBounds.max;
      }
    }

    const minText = formatDimensionPoint(min);
    const maxText = formatDimensionPoint(max);

    if (!minText && !maxText) return 'N/A';
    if (minText && maxText) return `${minText} — ${maxText}`;
    return minText || maxText || 'N/A';
  };

  const canSell = (item: InventoryItem) => {
    return item.availablePieces > 0 || item.availableWeight > 0;
  };

  const getPriceDisplay = (item: InventoryItem) => {
    const saleCode = item.saleCode;
    if (!saleCode) return '-';
    const isNumeric = !isNaN(parseFloat(saleCode)) && isFinite(parseFloat(saleCode));
    if (isNumeric) return `$${parseFloat(saleCode).toFixed(2)}/ct`;
    return 'Confidential';
  };

  const getTotalPriceDisplay = (item: InventoryItem) => {
    const saleCode = item.saleCode;
    if (!saleCode) return '-';
    const isNumeric = !isNaN(parseFloat(saleCode)) && isFinite(parseFloat(saleCode));
    if (isNumeric && item.totalPrice) return `$${item.totalPrice.toFixed(2)}`;
    return 'Confidential';
  };

  const getCuttingStyleDisplay = (code?: string) => {
    if (!code) return '-';
    return `${code} - ${CUTTING_STYLES[code as CuttingStyleCode] || code}`;
  };

  const formatOptionalInteger = (value?: number | null) => {
    if (value === undefined || value === null) return '-';
    return String(value);
  };

  const formatOptionalDecimal = (value?: number | null) => {
    if (value === undefined || value === null) return '-';
    return Number(value).toFixed(2);
  };

  const SortableHeader: React.FC<{ field: string; children: React.ReactNode }> = ({ field, children }) => {
    const isActive = sortBy === field;
    return (
      <th
        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground select-none"
        onClick={() => onSort?.(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          )}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const safeInventory = Array.isArray(inventory) ? inventory : [];

  if (safeInventory.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No inventory items found</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <SortableHeader field="serialNumber">Serial Number</SortableHeader>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Category
                </th>
                <SortableHeader field="cuttingStyle">Cut Style</SortableHeader>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Series
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Shapes
                </th>
                <SortableHeader field="availablePieces">Pieces</SortableHeader>
                <SortableHeader field="availableWeight">Weight (ct)</SortableHeader>
                <SortableHeader field="lines">Lines</SortableHeader>
                <SortableHeader field="grossWeight">Gross Wt</SortableHeader>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Dimensions
                </th>
                <SortableHeader field="purchaseCode">Purchase Price</SortableHeader>
                <SortableHeader field="saleCode">Sale Price</SortableHeader>
                <SortableHeader field="status">Status</SortableHeader>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {safeInventory.map((item) => (
                <tr
                  key={item._id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <td className="p-4 align-middle font-medium">
                    {item.serialNumber}
                  </td>
                  <td className="p-4 align-middle">
                    {item.category?.name || 'N/A'}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {getCuttingStyleDisplay(item.cuttingStyle)}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {item.series?.name || '-'}
                  </td>
                  <td className="p-4 align-middle">
                    {renderShapes(item)}
                  </td>
                  <td className="p-4 align-middle">
                    <span className={item.availablePieces < item.totalPieces ? 'text-orange-600' : ''}>
                      {item.availablePieces}
                    </span>
                    {' / '}
                    {item.totalPieces}
                  </td>
                  <td className="p-4 align-middle">
                    <span className={item.availableWeight < item.totalWeight ? 'text-orange-600' : ''}>
                      {(item.availableWeight || 0).toFixed(2)}
                    </span>
                    {' / '}
                    {(item.totalWeight || 0).toFixed(2)}
                  </td>
                  <td className="p-4 align-middle">
                    {formatOptionalInteger(item.lines)}
                  </td>
                  <td className="p-4 align-middle">
                    {formatOptionalDecimal(item.grossWeight)}
                  </td>
                  <td className="p-4 align-middle text-sm text-muted-foreground">
                    {formatDimensions(item)}
                  </td>
                  <td className="p-4 align-middle">
                    {item.purchaseCode ? item.purchaseCode : '-'}
                  </td>
                  <td className="p-4 align-middle">
                    {item.saleCode ? item.saleCode : '-'}
                  </td>
                  <td className="p-4 align-middle">
                    {getStatusBadge(item)}
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex gap-1">
                      {/* Edit Button (Admin Only) */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditItem(item);
                            setIsEditDialogOpen(true);
                          }}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Merge Button (Admin Only) */}
                      {isAdmin && canSell(item) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMergeItem(item);
                            setIsMergeDialogOpen(true);
                          }}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          title="Merge into another packet"
                        >
                          <Merge className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Sell Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSaleItem(item);
                          setIsSellDialogOpen(true);
                        }}
                        disabled={!canSell(item)}
                        className={canSell(item) ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : ''}
                        title="Sell"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>

                      {/* Delete Button (Admin Only) */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item._id}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      {editItem && (
        <AddInventoryDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditItem(undefined);
          }}
          onSuccess={onRefresh}
          categories={categories}
          editItem={editItem}
        />
      )}

      {/* Sell Dialog */}
      {saleItem && (
        <SellInventoryDialog
          open={isSellDialogOpen}
          onOpenChange={(open) => {
            setIsSellDialogOpen(open);
            if (!open) setSaleItem(undefined);
          }}
          item={saleItem}
          onSuccess={onRefresh}
        />
      )}

      {/* Merge Dialog */}
      {mergeItem && (
        <MergePacketDialog
          open={isMergeDialogOpen}
          onOpenChange={(open) => {
            setIsMergeDialogOpen(open);
            if (!open) setMergeItem(undefined);
          }}
          sourceItem={mergeItem}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};
