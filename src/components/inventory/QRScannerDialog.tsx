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
import { AlertCircle, Loader2 } from 'lucide-react';
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
  const isCleaningUp = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const stopScanner = async () => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.log('Stop error:', e);
      }
      try {
        scannerRef.current.clear();
      } catch (e) {
        console.log('Clear error:', e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    isCleaningUp.current = false;
  };

  const startScanner = async () => {
    if (isCleaningUp.current) {
      setTimeout(() => startScanner(), 100);
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      // Wait for DOM to be ready
      const element = document.getElementById('qr-reader');
      if (!element) {
        setTimeout(() => startScanner(), 300);
        return;
      }

      // Check camera availability
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          setError('No camera found on this device.');
          setIsStarting(false);
          return;
        }
      } catch (cameraCheckError) {
        console.error('Camera check error:', cameraCheckError);
      }

      // Initialize scanner
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' }, // rear camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        (errorMessage: string) => {
          // Ignore "QR code not found" errors - these are expected
          if (!errorMessage?.includes('NotFoundException')) {
            console.debug('Scan error:', errorMessage);
          }
        }
      );
      setScanning(true);
    } catch (err: any) {
      console.error('Scanner initialization error:', err);
      let errorMessage = 'Could not access camera. Please check permissions.';

      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.message?.includes('already in use')) {
        errorMessage = 'Camera is already in use by another app.';
      } else if (err.message) {
        errorMessage = `Camera error: ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open]);

  const handleScanSuccess = async (decodedText: string) => {
    // Stop scanner immediately to prevent multiple detections
    await stopScanner();

    try {
      const parsed = JSON.parse(decodedText);
      const itemId = parsed.id;

      if (!itemId) {
        toast.error('Invalid QR code format');
        setTimeout(() => startScanner(), 500);
        return;
      }

      const response = await api.getInventoryById(itemId);
      if (response.success && response.data) {
        setFoundItem(response.data);
        setDetailOpen(true);
        toast.success(`Found: ${response.data.serialNumber}`);
      } else {
        toast.error('Item not found');
        setTimeout(() => startScanner(), 500);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Invalid QR code');
      setTimeout(() => startScanner(), 500);
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

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      stopScanner();
    }
    onOpenChange(isOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at an inventory QR code to look up the item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Camera Feed Container */}
            <div
              id="qr-reader"
              className="w-full rounded-md overflow-hidden bg-black min-h-[300px] border border-border"
            />

            {/* Status Messages */}
            {isStarting && (
              <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-700 dark:text-blue-300">Starting camera...</p>
              </div>
            )}

            {scanning && !error && (
              <p className="text-sm text-center text-muted-foreground">
                Scanning... Hold the QR code steady in the frame.
              </p>
            )}

            {error && (
              <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-950 rounded-md border border-red-200 dark:border-red-800">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-700 dark:text-red-300">{error}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    💡 On Chrome: Click the 🔒 in address bar → Camera → Allow
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {error && (
              <Button
                variant="outline"
                onClick={startScanner}
                disabled={isStarting}
              >
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
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
