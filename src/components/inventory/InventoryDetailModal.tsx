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

  const normalizeStatus = (status?: string) => {
    if (!status) return '';
    return String(status).trim().toLowerCase().replace(/\s+/g, '_');
  };

  const getStatusBadge = () => {
    const normalizedStatus = normalizeStatus(item.status);

    if (normalizedStatus === 'in_stock') {
      return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">In Stock</Badge>;
    }

    if (normalizedStatus === 'pending') {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
    }

    if (normalizedStatus === 'partially_sold') {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Partially Sold</Badge>;
    }

    if (normalizedStatus === 'sold') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">Sold</Badge>;
    }

    return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">-</Badge>;
  };

  const getCuttingStyleDisplay = (code?: string) => {
    if (!code) return '-';
    return `${code} - ${CUTTING_STYLES[code as CuttingStyleCode] || code}`;
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

  const getMixDimensionBounds = () => {
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

  const formatDimensions = () => {
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
      const mixBounds = getMixDimensionBounds();
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
