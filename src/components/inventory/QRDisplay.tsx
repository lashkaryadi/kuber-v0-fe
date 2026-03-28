import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/services/api';

interface QRDisplayProps {
  itemId: string;
  itemSerialNumber: string;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
  showDownloadButton?: boolean;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({
  itemId,
  itemSerialNumber,
  size = 'medium',
  showDetails = true,
  showDownloadButton = true,
}) => {
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sizeMap = {
    small: 80,
    medium: 150,
    large: 200,
  };

  const qrSize = sizeMap[size];

  useEffect(() => {
    if (showDetails) {
      fetchQRData();
    }
  }, [itemId, showDetails]);

  const fetchQRData = async () => {
    try {
      setLoading(true);
      const response = await api.displayItemQR(itemId);
      if (response.success) {
        setQrData(response.data);
      }
    } catch (error) {
      console.error('Error fetching QR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const qrValue = JSON.stringify({ id: itemId, sn: itemSerialNumber, type: 'item' });

  const downloadQR = () => {
    const element = document.getElementById(`qr-${itemId}`);
    if (element) {
      const canvas = element.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `QR-${itemSerialNumber}.png`;
        link.click();
        toast.success('QR code downloaded');
      }
    }
  };

  const copyQRValue = () => {
    navigator.clipboard.writeText(qrValue);
    toast.success('QR data copied to clipboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        {/* QR Code */}
        <div
          id={`qr-${itemId}`}
          className="p-2 bg-white border rounded-md"
        >
          <QRCodeSVG
            value={qrValue}
            size={qrSize}
            level="M"
            includeMargin={true}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {showDownloadButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQR}
              className="gap-2"
              title="Download QR code as PNG"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={copyQRValue}
            className="gap-2"
            title="Copy QR data"
          >
            <Copy className="w-4 h-4" />
            Copy
          </Button>
        </div>
      </div>

      {/* Item Details */}
      {showDetails && !loading && qrData && (
        <div className="text-center space-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Serial Number</p>
            <p className="font-semibold">{qrData.item?.serialNumber}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium">{qrData.item?.category}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="font-medium">{qrData.item?.weight?.toFixed(2)} ct</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pieces</p>
              <p className="font-medium">{qrData.item?.pieces}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{qrData.item?.status}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
