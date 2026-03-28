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
import { AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.log('Stop error:', e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    try {
      // Query the DOM element with multiple retries
      let element = document.getElementById('qr-reader');
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds total
      
      while (!element && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        element = document.getElementById('qr-reader');
        attempts++;
      }

      if (!element) {
        // Don't throw - just log and return gracefully
        console.error('QR reader element still not found after retries');
        setError('Camera setup failed. Please close and reopen the dialog.');
        return;
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      // Use smaller, adaptive qrbox to avoid canvas errors on mobile
      const qrboxSize = Math.min(window.innerWidth * 0.6, 150); // 60% of viewport or 150px max

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        handleScanSuccess,
        (errorMessage: string) => {
          // Suppress all non-critical errors to avoid cluttering console
          // Only log unexpected errors
          if (errorMessage?.includes('NotFoundException') || 
              errorMessage?.includes('Not found') ||
              errorMessage?.includes('IndexSizeError')) {
            return; // Expected errors during scanning or video initialization
          }
        }
      );
      setScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      let errorMessage = 'Could not access camera. Please check permissions.';

      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied') || err.message?.includes('Unknown error')) {
        errorMessage = 'Camera permission denied. Please allow camera access in settings.';
      } else if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        errorMessage = 'No camera found on this device.';
      } else if (err.message?.includes('not available')) {
        errorMessage = 'Camera is not available. Ensure you are using HTTPS.';
      }

      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    if (!open) return;

    // Delay scanner start to allow dialog to fully render
    const timer = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [open]);

  const handleScanSuccess = async (decodedText: string) => {
    // Stop scanner immediately to prevent multiple detections
    await stopScanner();

    try {
      console.log('QR Scanned raw:', decodedText);
      
      let itemId: string | null = null;
      let serialNumber: string | null = null;

      try {
        // Try parsing as JSON first
        const parsed = JSON.parse(decodedText);
        itemId = parsed.id;
        serialNumber = parsed.sn;
        console.log('QR parsed JSON:', { itemId, serialNumber });
      } catch (e) {
        // If not JSON, try treating it as plain ID
        itemId = decodedText.trim();
        console.log('QR treated as plain ID:', itemId);
      }

      if (!itemId) {
        toast.error('Invalid QR code format - no ID found');
        setTimeout(() => startScanner(), 500);
        return;
      }

      toast.loading('Fetching item details...');
      const response = await api.getInventoryById(itemId);
      console.log('API response:', response);
      
      // Handle nested response structure
      const itemData = response.data?.data || response.data;
      
      if (response.success && itemData) {
        setFoundItem(itemData);
        setDetailOpen(true);
        toast.success(`Found: ${itemData.serialNumber}`);
      } else {
        console.error('No data in response:', response);
        toast.error(response.message || 'Item not found');
        setTimeout(() => startScanner(), 500);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      toast.error('Failed to process QR code');
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
