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
import { AlertCircle, ArrowLeft } from 'lucide-react';
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
  const [lastScanResult, setLastScanResult] = useState('No scan yet');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);
    updateIsMobile();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateIsMobile);
      return () => mediaQuery.removeEventListener('change', updateIsMobile);
    }

    mediaQuery.addListener(updateIsMobile);
    return () => mediaQuery.removeListener(updateIsMobile);
  }, []);

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
      if (scannerRef.current?.isScanning) {
        await stopScanner();
      }

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

      const qrboxSize = isMobile ? 250 : Math.min(window.innerWidth * 0.5, 260);
      const scannerConfig = {
        fps: 10,
        qrbox: { width: qrboxSize, height: qrboxSize },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      const onScanFailure = (errorMessage: string) => {
        if (
          errorMessage?.includes('NotFoundException') ||
          errorMessage?.includes('Not found') ||
          errorMessage?.includes('IndexSizeError')
        ) {
          return;
        }
      };

      try {
        // Use soft constraint for back camera (environment) - works on all devices
        await scanner.start(
          { facingMode: 'environment' },
          scannerConfig,
          handleScanSuccess,
          onScanFailure
        );
        console.log('Camera started: back camera (environment facingMode)');
      } catch (cameraError) {
        console.error('Failed to access back camera:', cameraError);
        // Only throw error - don't attempt fallback to selfie camera
        setError('Could not access back camera. Please check camera permissions.');
        throw cameraError;
      }

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

    setError(null);
    setFoundItem(null);
    setDetailOpen(false);
    setLastScanResult('No scan yet');

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

      try {
        // Try parsing as JSON first
        const parsed = JSON.parse(decodedText);
        itemId = parsed.id;
        console.log('QR parsed JSON:', { itemId, serialNumber: parsed.sn });
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
        setDetailOpen(false);
        setLastScanResult(`${itemData.serialNumber} - ${itemData.category?.name || 'Item'}`);
        toast.success(`Found: ${itemData.serialNumber}`);
      } else {
        console.error('No data in response:', response);
        setLastScanResult('Item not found');
        toast.error(response.message || 'Item not found');
        setTimeout(() => startScanner(), 500);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      setLastScanResult('Failed to process QR code');
      toast.error('Failed to process QR code');
      setTimeout(() => startScanner(), 500);
    }
  };

  const handleCloseDetail = (isOpen: boolean) => {
    setDetailOpen(isOpen);
    if (!isOpen) {
      if (open) {
        startScanner();
      }
    }
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      stopScanner();
      setError(null);
      setFoundItem(null);
      setDetailOpen(false);
      setLastScanResult('No scan yet');
    }
    onOpenChange(isOpen);
  };

  // Mobile full-screen overlay rendering
  if (isMobile && open) {
    return (
      <>
        <div className="fixed inset-0 bg-black z-[9998]" />
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          {/* Fixed Header */}
          <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-black/95 border-b border-white/10 z-[10001]">
            <button
              onClick={() => handleDialogOpenChange(false)}
              className="flex items-center gap-2 text-white hover:bg-white/10 px-2 py-2 rounded-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-base font-semibold text-white">Scan QR Code</p>
            <span className="w-12" />
          </div>

          {/* Camera View - fills remaining height */}
          <div className="flex-1 mt-16 relative bg-black flex items-center justify-center overflow-hidden">
            <div
              id="qr-reader"
              className="absolute inset-0 w-full h-full"
            />
            
            {/* Targeting overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[250px] h-[250px] rounded-2xl border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
              <p className="absolute bottom-8 left-0 right-0 text-center text-white text-sm font-medium">
                Point camera at QR code
              </p>
            </div>
          </div>

          {/* Fixed Result Panel - Bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 shadow-lg z-[10000]">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Scan Status</p>
                <p className="text-xs text-slate-500 mt-1">
                  {scanning ? 'Scanning... Hold the QR code steady.' : 'Scanner ready.'}
                </p>
              </div>

              {error && (
                <div className="flex gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500">Last Result:</p>
                <p className="text-sm font-medium text-slate-900 truncate mt-1">{lastScanResult}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 h-12 bg-primary text-white"
                  onClick={() => setDetailOpen(true)}
                  disabled={!foundItem}
                >
                  View Details
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={startScanner}
                >
                  Scan Again
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {foundItem && (
          <InventoryDetailModal
            item={foundItem}
            open={detailOpen}
            onOpenChange={handleCloseDetail}
          />
        )}
      </>
    );
  }

  // Desktop dialog rendering
  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md">
          <>
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Point your camera at an inventory QR code to look up the item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div
                id="qr-reader"
                className="w-full rounded-md overflow-hidden bg-black min-h-[320px] border border-border"
              />

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
                      On Chrome: Click the lock icon in address bar then allow camera access.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-md border bg-muted/40">
                <p className="text-xs text-muted-foreground">Last scan result:</p>
                <p className="text-sm font-medium truncate">{lastScanResult}</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  disabled={!foundItem}
                  onClick={() => setDetailOpen(true)}
                >
                  View Item Detail
                </Button>
                <Button
                  variant="outline"
                  onClick={startScanner}
                >
                  Scan Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </>
        </DialogContent>
      </Dialog>

      {foundItem && (
        <InventoryDetailModal
          item={foundItem}
          open={detailOpen}
          onOpenChange={handleCloseDetail}
        />
      )}
    </>
  );
};
