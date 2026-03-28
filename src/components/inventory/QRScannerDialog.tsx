import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/services/api';
import { InventoryItem } from '@/types/inventory';
import { InventoryDetailModal } from './InventoryDetailModal';

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QRScannerDialog: React.FC<QRScannerDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (open) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        () => {} // ignore scan failures (no QR detected yet)
      );
      setScanning(true);
    } catch (error) {
      console.error('Failed to start scanner:', error);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    // Pause scanner immediately
    await stopScanner();

    try {
      const parsed = JSON.parse(decodedText);
      const itemId = parsed.id;

      if (!itemId) {
        toast.error('Invalid QR code format');
        startScanner();
        return;
      }

      const response = await api.getInventoryById(itemId);
      if (response.success && response.data) {
        setFoundItem(response.data);
        setDetailOpen(true);
        toast.success(`Found: ${response.data.serialNumber}`);
      } else {
        toast.error('Item not found');
        startScanner();
      }
    } catch {
      toast.error('Invalid QR code');
      startScanner();
    }
  };

  const handleCloseDetail = (isOpen: boolean) => {
    setDetailOpen(isOpen);
    if (!isOpen) {
      setFoundItem(null);
      if (open) {
        startScanner();
      }
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) stopScanner();
          onOpenChange(isOpen);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at an inventory QR code to look up the item.
            </DialogDescription>
          </DialogHeader>

          <div
            id="qr-reader"
            className="w-full rounded-md overflow-hidden bg-black min-h-[300px]"
          />

          {scanning && (
            <p className="text-sm text-center text-muted-foreground">
              Scanning... Hold the QR code steady in the frame.
            </p>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {foundItem && (
        <InventoryDetailModal
          open={detailOpen}
          onOpenChange={handleCloseDetail}
          item={foundItem}
        />
      )}
    </>
  );
};
