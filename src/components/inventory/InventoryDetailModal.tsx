import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { InventoryItem, CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';
import { BASE_URL } from '@/services/api';

interface InventoryDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
}

export const InventoryDetailModal: React.FC<InventoryDetailModalProps> = ({
  open,
  onOpenChange,
  item,
}) => {
  const getImageUrl = (imagePath: string): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    if (imagePath.startsWith('/')) {
      return `${BASE_URL}${imagePath}`;
    }
    return `${BASE_URL}/uploads/${imagePath}`;
  };

  const getStatusBadge = () => {
    const isSold = item.availablePieces === 0 && item.availableWeight === 0;
    const isPartial = item.availablePieces < item.totalPieces || item.availableWeight < item.totalWeight;

    if (isSold || item.status === 'sold') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">Sold</Badge>;
    }
    if (item.status === 'pending') {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
    }
    if (isPartial || item.status === 'partially_sold') {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Partially Sold</Badge>;
    }
    return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">In Stock</Badge>;
  };

  const getCuttingStyleDisplay = (code?: string) => {
    if (!code) return '-';
    return `${code} - ${CUTTING_STYLES[code as CuttingStyleCode] || code}`;
  };

  const formatDimensions = () => {
    if (!item.dimensions) return 'N/A';
    const { min, max, unit } = item.dimensions;
    const hasMin = (min?.length || 0) > 0 || (min?.width || 0) > 0;
    const hasMax = (max?.length || 0) > 0 || (max?.width || 0) > 0;
    if (!hasMin && !hasMax) return 'N/A';

    const parts = [];
    if (hasMin) parts.push(`${min.length}x${min.width}`);
    if (hasMax) parts.push(`${max.length}x${max.width}`);
    return parts.join(' - ') + ` ${unit || 'mm'}`;
  };

  const getPriceDisplay = () => {
    const saleCode = item.saleCode;
    if (!saleCode) return '-';
    const isNumeric = !isNaN(parseFloat(saleCode)) && isFinite(parseFloat(saleCode));
    if (isNumeric) return `$${parseFloat(saleCode).toFixed(2)}/ct`;
    return 'Confidential';
  };

  const getTotalPriceDisplay = () => {
    const saleCode = item.saleCode;
    if (!saleCode) return '-';
    const isNumeric = !isNaN(parseFloat(saleCode)) && isFinite(parseFloat(saleCode));
    if (isNumeric && item.totalPrice) return `$${item.totalPrice.toFixed(2)}`;
    return 'Confidential';
  };

  const renderShapes = () => {
    if (item.shapeType === 'single') {
      return item.singleShape || 'N/A';
    }
    if (item.shapes && item.shapes.length > 0) {
      return item.shapes.map(s => `${s.shape} (${s.pieces}pc, ${(s.weight || 0).toFixed(2)}ct)`).join(', ');
    }
    return 'N/A';
  };

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '-'}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{item.serialNumber}</span>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Images */}
          {item.images && item.images.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Images</p>
              <div className="flex gap-2 flex-wrap">
                {item.images.map((img, i) => (
                  <img
                    key={i}
                    src={getImageUrl(img)}
                    alt={`${item.serialNumber}-${i}`}
                    className="w-24 h-24 object-cover rounded-md border"
                  />
                ))}
              </div>
            </div>
          )}

          {/* QR Code */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">QR Code</p>
            <div className="flex items-center gap-4">
              <QRCodeSVG
                value={JSON.stringify({ id: item._id, sn: item.serialNumber })}
                size={100}
                level="M"
              />
              <div className="text-xs text-muted-foreground">
                <p>Scan to identify this item</p>
                <p className="font-medium text-foreground">{item.serialNumber}</p>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <p className="text-sm font-semibold mb-3 border-b pb-1">Classification</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Category" value={item.category?.name} />
              <Field label="Cutting Style" value={getCuttingStyleDisplay(item.cuttingStyle)} />
              <Field label="Series" value={item.series?.name} />
              <Field label="Lot Type" value={item.shapeType === 'single' ? 'Single Shape' : 'Mix Shape'} />
            </div>
          </div>

          {/* Shapes */}
          <div>
            <p className="text-sm font-semibold mb-3 border-b pb-1">Shapes</p>
            <p className="text-sm">{renderShapes()}</p>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold mb-3 border-b pb-1">Quantity</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Total Pieces" value={item.totalPieces} />
              <Field label="Available Pieces" value={item.availablePieces} />
              <Field label="Total Weight" value={`${(item.totalWeight || 0).toFixed(2)} ct`} />
              <Field label="Available Weight" value={`${(item.availableWeight || 0).toFixed(2)} ct`} />
            </div>
          </div>

          {/* Pricing */}
          <div>
            <p className="text-sm font-semibold mb-3 border-b pb-1">Pricing</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Purchase Code" value={item.purchaseCode} />
              <Field label="Sale Code" value={item.saleCode} />
              <Field label="Price/Carat" value={getPriceDisplay()} />
              <Field label="Total Value" value={getTotalPriceDisplay()} />
            </div>
          </div>

          {/* Physical Attributes */}
          <div>
            <p className="text-sm font-semibold mb-3 border-b pb-1">Physical Attributes</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Dimensions" value={formatDimensions()} />
              <Field label="Certification" value={item.certification} />
              <Field label="Location" value={item.location} />
            </div>
          </div>

          {/* Source */}
          {item.mineName && (
            <div>
              <p className="text-sm font-semibold mb-3 border-b pb-1">Source</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mine Name" value={item.mineName} />
              </div>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <p className="text-sm font-semibold mb-3 border-b pb-1">Description</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          )}

          {/* Metadata */}
          <div>
            <p className="text-sm font-semibold mb-3 border-b pb-1">Metadata</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Created" value={item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'} />
              <Field label="Last Updated" value={item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
