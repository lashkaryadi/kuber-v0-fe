import React, { useState } from 'react';
import { Eye, Edit, ShoppingCart, Trash2, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem, Category, CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';
import { AddInventoryDialog } from './AddInventoryDialog';
import { SellInventoryDialog } from './SellInventoryDialog';
import { MergePacketDialog } from './MergePacketDialog';
import { InventoryDetailModal } from './InventoryDetailModal';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryCardViewProps {
  inventory: InventoryItem[];
  loading: boolean;
  onRefresh: () => void;
  categories?: Category[];
}

export const InventoryCardView: React.FC<InventoryCardViewProps> = ({
  inventory,
  loading,
  onRefresh,
  categories = [],
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

  const isAdmin = user?.role === 'admin';

  const handleDelete = async (item: InventoryItem) => {
    if (!isAdmin) {
      toast.error('Only admins can delete inventory items');
      return;
    }
    if (!confirm(`Are you sure you want to delete item ${item.serialNumber}?`)) return;

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
    const isSold = item.availablePieces === 0 && item.availableWeight === 0;
    const isPartial = item.availablePieces < item.totalPieces || item.availableWeight < item.totalWeight;

    if (isSold || item.status === 'sold') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 text-xs">Sold</Badge>;
    }
    if (item.status === 'pending') {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">Pending</Badge>;
    }
    if (isPartial || item.status === 'partially_sold') {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">Partial</Badge>;
    }
    return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">In Stock</Badge>;
  };

  const getShapeDisplay = (item: InventoryItem) => {
    if (item.shapeType === 'single') return item.singleShape || 'N/A';
    if (item.shapes && item.shapes.length > 0) {
      const names = item.shapes.map(s => s.shape);
      return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    }
    return 'N/A';
  };

  const canSell = (item: InventoryItem) => item.availablePieces > 0 || item.availableWeight > 0;

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
            {item.images && item.images.length > 0 ? (
              <div className="h-36 bg-muted overflow-hidden">
                <img
                  src={item.images[0]}
                  alt={item.serialNumber}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="h-20 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground/30">
                  {item.category?.name?.charAt(0) || 'G'}
                </span>
              </div>
            )}

            {/* Card Body */}
            <div className="p-3 space-y-2">
              {/* Serial + Status */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm truncate">{item.serialNumber}</span>
                {getStatusBadge(item)}
              </div>

              {/* Category + Cutting Style */}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{item.category?.name || 'Uncategorized'}</p>
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
