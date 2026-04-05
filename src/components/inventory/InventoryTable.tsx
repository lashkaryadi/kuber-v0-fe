import React, { useState } from 'react';
import { Edit, Trash2, ShoppingCart, Merge, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem, Category, Series, CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';
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
  seriesList?: Series[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  inventory,
  loading,
  onRefresh,
  categories = [],
  seriesList = [],
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

    if (!confirm(`Are you sure you want to delete item ${getSerialDisplay(item)}?`)) {
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
    return status.toString().trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  };

  const getReferenceId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    return String(value?._id || value?.id || '').trim();
  };

  const getReferenceName = (value: any): string => {
    if (!value || typeof value === 'string') return '';
    return String(value?.name || '').trim();
  };

  const getCategoryLabel = (item: InventoryItem) => {
    const directName = getReferenceName(item.category);
    if (directName) {
      return directName;
    }

    const categoryId = getReferenceId(item.category);
    if (!categoryId) {
      return 'Uncategorized';
    }

    const match = categories.find((category) => {
      const id = String((category as any)?._id || (category as any)?.id || '').trim();
      return id === categoryId;
    });

    return match?.name || 'Uncategorized';
  };

  const getSeriesLabel = (item: InventoryItem) => {
    const directName = getReferenceName(item.series);
    if (directName) {
      return directName;
    }

    const seriesId = getReferenceId(item.series);
    if (!seriesId) {
      return '-';
    }

    const match = seriesList.find((series) => {
      const id = String((series as any)?._id || (series as any)?.id || '').trim();
      return id === seriesId;
    });

    return match?.name || '-';
  };

  const getSerialDisplay = (item: InventoryItem) => {
    const explicit = String(item.serialNumber || '').trim();
    if (explicit) {
      return explicit;
    }

    const idToken = String(item._id || (item as any).id || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(-6);
    return idToken ? `#${idToken}` : '-';
  };

  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const hasDimension = (point?: { length?: number; width?: number }) => {
    return (point?.length || 0) > 0 || (point?.width || 0) > 0;
  };

  const formatDimensionNumber = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  };

  const formatDimensionPoint = (point?: { length?: number; width?: number }) => {
    if (!hasDimension(point)) return 'N/A';
    const length = (point?.length || 0) > 0 ? formatDimensionNumber(point!.length!) : '?';
    const width = (point?.width || 0) > 0 ? formatDimensionNumber(point!.width!) : '?';
    return `${length}x${width}`;
  };

  const getByPath = (source: any, path: string): unknown => {
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), source);
  };

  const parseDimensionText = (value: unknown): { length: number; width: number } | null => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    return {
      length: Number.parseFloat(match[1]),
      width: Number.parseFloat(match[2]),
    };
  };

  const firstNumericValue = (source: any, paths: string[]): number | null => {
    for (const path of paths) {
      const parsed = toNumber(getByPath(source, path));
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  };

  const getDimensionPoint = (source: any, pointType: 'min' | 'max') => {
    const isMin = pointType === 'min';
    const objectPaths = isMin
      ? ['dimensions.min', 'dimensionMin', 'dimMin', 'minDimension']
      : ['dimensions.max', 'dimensionMax', 'dimMax', 'maxDimension'];
    const lengthPaths = isMin
      ? ['dimMinLength', 'dimensionMinLength', 'minLength', 'dimension_min_length']
      : ['dimMaxLength', 'dimensionMaxLength', 'maxLength', 'dimension_max_length'];
    const widthPaths = isMin
      ? ['dimMinWidth', 'dimensionMinWidth', 'minWidth', 'dimension_min_width']
      : ['dimMaxWidth', 'dimensionMaxWidth', 'maxWidth', 'dimension_max_width'];

    for (const objectPath of objectPaths) {
      const value = getByPath(source, objectPath);
      if (value && typeof value === 'object') {
        const length = toNumber((value as any).length);
        const width = toNumber((value as any).width);
        if (length !== null || width !== null) {
          return {
            length: length || 0,
            width: width || 0,
          };
        }
      }

      const parsedText = parseDimensionText(value);
      if (parsedText) {
        return parsedText;
      }
    }

    const length = firstNumericValue(source, lengthPaths);
    const width = firstNumericValue(source, widthPaths);

    return {
      length: length || 0,
      width: width || 0,
    };
  };

  const getDimensionRange = (source: any) => {
    const min = getDimensionPoint(source, 'min');
    const max = getDimensionPoint(source, 'max');

    if (!hasDimension(min) && !hasDimension(max)) {
      const legacyLength = firstNumericValue(source, ['dimensions.length', 'dimensionLength', 'dimLength']);
      const legacyWidth = firstNumericValue(source, ['dimensions.width', 'dimensionWidth', 'dimWidth']);
      if ((legacyLength || 0) > 0 || (legacyWidth || 0) > 0) {
        return {
          min: { length: legacyLength || 0, width: legacyWidth || 0 },
          max: { length: legacyLength || 0, width: legacyWidth || 0 },
        };
      }
    }

    return { min, max };
  };

  const getMixOverallRange = (item: InventoryItem) => {
    const shapes = Array.isArray(item.shapes) ? item.shapes : [];
    if (shapes.length === 0) return null;

    const minLengths: number[] = [];
    const minWidths: number[] = [];
    const maxLengths: number[] = [];
    const maxWidths: number[] = [];

    for (const shape of shapes) {
      const range = getDimensionRange(shape as any);
      if ((range.min.length || 0) > 0) minLengths.push(range.min.length);
      if ((range.min.width || 0) > 0) minWidths.push(range.min.width);
      if ((range.max.length || 0) > 0) maxLengths.push(range.max.length);
      if ((range.max.width || 0) > 0) maxWidths.push(range.max.width);
    }

    const min = {
      length: minLengths.length ? Math.min(...minLengths) : 0,
      width: minWidths.length ? Math.min(...minWidths) : 0,
    };
    const max = {
      length: maxLengths.length ? Math.max(...maxLengths) : 0,
      width: maxWidths.length ? Math.max(...maxWidths) : 0,
    };

    if (!hasDimension(min) && !hasDimension(max)) {
      return null;
    }

    return { min, max };
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
      <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20">
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

  const formatDimensions = (item: InventoryItem) => {
    const range = item.shapeType === 'mix'
      ? (getMixOverallRange(item) || getDimensionRange(item as any))
      : getDimensionRange(item as any);

    const hasMin = hasDimension(range.min);
    const hasMax = hasDimension(range.max);

    if (!hasMin && !hasMax) return 'N/A';
    if (hasMin && hasMax) return `${formatDimensionPoint(range.min)} - ${formatDimensionPoint(range.max)}`;
    return hasMin ? formatDimensionPoint(range.min) : formatDimensionPoint(range.max);
  };

  const canSell = (item: InventoryItem) => {
    const normalizedStatus = normalizeStatus(item.status);
    if (normalizedStatus === 'sold') {
      return false;
    }
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
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Dimensions
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Lines
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                  Gross Wt
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
                    {getSerialDisplay(item)}
                  </td>
                  <td className="p-4 align-middle">
                    {getCategoryLabel(item)}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {getCuttingStyleDisplay(item.cuttingStyle)}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {getSeriesLabel(item)}
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
                  <td className="p-4 align-middle text-sm text-muted-foreground">
                    {formatDimensions(item)}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {item.lines || '-'}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {item.grossWeight ? Number(item.grossWeight).toFixed(2) : '-'}
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
