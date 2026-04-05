import React, { useState } from 'react';
import { Eye, Edit, ShoppingCart, Trash2, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem, Category, Series, CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';
import { AddInventoryDialog } from './AddInventoryDialog';
import { SellInventoryDialog } from './SellInventoryDialog';
import { MergePacketDialog } from './MergePacketDialog';
import { InventoryDetailModal } from './InventoryDetailModal';
import { toast } from 'sonner';
import api, { BASE_URL } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryCardViewProps {
  inventory: InventoryItem[];
  loading: boolean;
  onRefresh: () => void;
  categories?: Category[];
  seriesList?: Series[];
}

export const InventoryCardView: React.FC<InventoryCardViewProps> = ({
  inventory,
  loading,
  onRefresh,
  categories = [],
  seriesList = [],
}) => {
  const { user } = useAuth();
  const [viewItem, setViewItem] = useState<InventoryItem | undefined>();
  const [editItem, setEditItem] = useState<InventoryItem | undefined>();
  const [saleItem, setSaleItem] = useState<InventoryItem | undefined>();
  const [mergeItem, setMergeItem] = useState<InventoryItem | undefined>();
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const isAdmin = user?.role === 'admin';

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

  const handleDelete = async (item: InventoryItem) => {
    if (!isAdmin) {
      toast.error('Only admins can delete inventory items');
      return;
    }
    if (!confirm(`Are you sure you want to delete item ${getSerialDisplay(item)}?`)) return;

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
      const err = error as any;
      toast.error(err?.response?.data?.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (item: InventoryItem) => {
    const normalizedStatus = item.status?.toString().trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

    if (normalizedStatus === 'in_stock') {
      return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">In Stock</Badge>;
    }
    if (normalizedStatus === 'pending') {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">Pending</Badge>;
    }
    if (normalizedStatus === 'partially_sold') {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">Partially Sold</Badge>;
    }
    if (normalizedStatus === 'sold') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 text-xs">Sold</Badge>;
    }

    return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20 text-xs">-</Badge>;
  };

  const getShapeDisplay = (item: InventoryItem) => {
    if (item.shapeType === 'single') return item.singleShape || 'N/A';
    if (item.shapes && item.shapes.length > 0) {
      const names = item.shapes.map(s => s.shape);
      return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    }
    return 'N/A';
  };

  const canSell = (item: InventoryItem) => {
    const normalizedStatus = normalizeStatus(item.status);
    if (normalizedStatus === 'sold') {
      return false;
    }
    return item.availablePieces > 0 || item.availableWeight > 0;
  };

  const handleImageError = (itemId: string, imageUrl: string) => {
    console.warn(`Image failed to load for item ${itemId}:`, imageUrl);
    setFailedImages(prev => new Set([...prev, itemId]));
  };

  const handleImageLoad = (itemId: string, imageUrl: string) => {
    console.log(`Image loaded successfully for item ${itemId}:`, imageUrl);
  };

  const getImageUrl = (imagePath: string): string => {
    if (!imagePath) return '';
    // If it's already an absolute URL, return as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // If it's a relative path, prepend BASE_URL
    if (imagePath.startsWith('/')) {
      return `${BASE_URL}${imagePath}`;
    }
    // Otherwise, treat as relative to uploads
    return `${BASE_URL}/uploads/${imagePath}`;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {safeInventory.map((item) => (
          <div
            key={item._id}
            className="border rounded-lg bg-card overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            {item.images && item.images.length > 0 && !failedImages.has(item._id) ? (
              <div className="h-36 bg-muted overflow-hidden">
                <img
                  src={getImageUrl(item.images[0])}
                  alt={getSerialDisplay(item)}
                  className="w-full h-full object-cover"
                  onLoad={() => handleImageLoad(item._id, item.images[0])}
                  onError={() => handleImageError(item._id, item.images[0])}
                />
              </div>
            ) : (
              <div className="h-36 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                <span className="text-5xl font-bold text-muted-foreground/30">
                  {getCategoryLabel(item).charAt(0) || 'G'}
                </span>
              </div>
            )}

            {/* Card Body */}
            <div className="p-3 space-y-2">
              {/* Serial + Status */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm truncate">{getSerialDisplay(item)}</span>
                {getStatusBadge(item)}
              </div>

              {/* Category + Cutting Style */}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{getCategoryLabel(item)}</p>
                <p>Series: {getSeriesLabel(item)}</p>
                {item.cuttingStyle && (
                  <p>{item.cuttingStyle} - {CUTTING_STYLES[item.cuttingStyle as CuttingStyleCode] || item.cuttingStyle}</p>
                )}
              </div>

              {/* Shape */}
              <div>
                <Badge variant="secondary" className="text-xs">
                  {getShapeDisplay(item)}
                </Badge>
              </div>

              {/* Weight + Pieces */}
              <div className="flex justify-between text-xs">
                <span>
                  <span className="text-muted-foreground">Wt: </span>
                  <span className={item.availableWeight < item.totalWeight ? 'text-orange-600 font-medium' : 'font-medium'}>
                    {(item.availableWeight || 0).toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/{(item.totalWeight || 0).toFixed(2)} ct</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Pcs: </span>
                  <span className={item.availablePieces < item.totalPieces ? 'text-orange-600 font-medium' : 'font-medium'}>
                    {item.availablePieces}
                  </span>
                  <span className="text-muted-foreground">/{item.totalPieces}</span>
                </span>
              </div>

              {/* Lines & Gross Weight */}
              {(item.lines || item.grossWeight) && (
                <div className="text-xs space-y-0.5 py-1 border-y">
                  {item.lines && (
                    <div>
                      <span className="text-muted-foreground">Lines: </span>
                      <span className="font-medium">{item.lines}</span>
                    </div>
                  )}
                  {item.grossWeight && (
                    <div>
                      <span className="text-muted-foreground">G.Wt: </span>
                      <span className="font-medium">{Number(item.grossWeight).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Purchase & Sale Price */}
              <div className="text-xs space-y-1 py-1 border-y">
                <div>
                  <span className="text-muted-foreground">Buy: </span>
                  <span className="font-medium">{item.purchaseCode ? item.purchaseCode : '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sell: </span>
                  <span className="font-medium">{item.saleCode ? item.saleCode : '-'}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 pt-1 border-t">
                {/* View Detail */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setViewItem(item);
                    setIsViewOpen(true);
                  }}
                  title="View details"
                  className="flex-1"
                >
                  <Eye className="w-4 h-4" />
                </Button>

                {/* Edit (Admin Only) */}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditItem(item);
                      setIsEditOpen(true);
                    }}
                    title="Edit"
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}

                {/* Merge (Admin Only) */}
                {isAdmin && canSell(item) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMergeItem(item);
                      setIsMergeOpen(true);
                    }}
                    className="flex-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    title="Merge"
                  >
                    <Merge className="w-4 h-4" />
                  </Button>
                )}

                {/* Sell */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSaleItem(item);
                    setIsSellOpen(true);
                  }}
                  disabled={!canSell(item)}
                  className={`flex-1 ${canSell(item) ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : ''}`}
                  title="Sell"
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>

                {/* Delete (Admin Only) */}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item._id}
                    className="flex-1 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {viewItem && (
        <InventoryDetailModal
          open={isViewOpen}
          onOpenChange={(open) => {
            setIsViewOpen(open);
            if (!open) setViewItem(undefined);
          }}
          item={viewItem}
        />
      )}

      {/* Edit Dialog */}
      {editItem && (
        <AddInventoryDialog
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
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
          open={isSellOpen}
          onOpenChange={(open) => {
            setIsSellOpen(open);
            if (!open) setSaleItem(undefined);
          }}
          item={saleItem}
          onSuccess={onRefresh}
        />
      )}

      {/* Merge Dialog */}
      {mergeItem && (
        <MergePacketDialog
          open={isMergeOpen}
          onOpenChange={(open) => {
            setIsMergeOpen(open);
            if (!open) setMergeItem(undefined);
          }}
          sourceItem={mergeItem}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};
