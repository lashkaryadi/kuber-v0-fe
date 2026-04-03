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
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

interface TallyScanningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  seriesName: string;
}

interface ScannedItem {
  id: string;
  sn?: string;
}

interface TallyResult {
  found: any[];
  missing: any[];
  extra: any[];
  totalExpected: number;
  totalFound: number;
  accuracy: number;
}

export const TallyScanningDialog: React.FC<TallyScanningDialogProps> = ({
  open,
  onOpenChange,
  seriesId,
  seriesName,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [seriesData, setSeriesData] = useState<any>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [tallyResult, setTallyResult] = useState<TallyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannedIdsRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    if (open) {
      loadSeriesData();
      // Delay scanner start to allow dialog to fully render
      const timer = setTimeout(() => {
        startScanner();
      }, 500);
      return () => clearTimeout(timer);
    }
    return () => {
      stopScanner();
    };
  }, [open, seriesId]);

  const loadSeriesData = async () => {
    try {
      setLoading(true);
      const response = await api.getSeriesForTally(seriesId);
      if (response.success) {
        setSeriesData(response.data);
      }
    } catch (error) {
      console.error('Error loading series data:', error);
      toast.error('Failed to load series data');
    } finally {
      setLoading(false);
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
      let element = document.getElementById('tally-qr-reader');
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds total
      
      while (!element && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        element = document.getElementById('tally-qr-reader');
        attempts++;
      }

      if (!element) {
        // Don't throw - just log and return gracefully
        console.error('QR reader element still not found after retries');
        setError('Camera setup failed. Please close and reopen the dialog.');
        return;
      }

      const scanner = new Html5Qrcode('tally-qr-reader');
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

  const handleScanSuccess = (decodedText: string) => {
    try {
      const parsed = JSON.parse(decodedText);
      const itemId = parsed.id;

      if (!itemId) return;

      // Prevent duplicates
      if (scannedIdsRef.current.has(itemId)) {
        toast.info(`Already scanned: ${parsed.sn || itemId}`);
        return;
      }

      scannedIdsRef.current.add(itemId);
      const newScannedItem: ScannedItem = { id: itemId, sn: parsed.sn };
      setScannedItems((prev) => [...prev, newScannedItem]);
      toast.success(`Scanned: ${parsed.sn || itemId.substring(0, 8)}`);
    } catch {
      toast.error('Invalid QR code format');
    }
  };

  const processTally = async () => {
    try {
      setLoading(true);
      const response = await api.processTallyScan(seriesId, scannedItems);
      if (response.success) {
        setTallyResult(response.data.tally);
        await stopScanner();
        toast.success('Tally completed');
      }
    } catch (error) {
      console.error('Error processing tally:', error);
      toast.error('Failed to process tally');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScannedItems([]);
    scannedIdsRef.current.clear();
    setTallyResult(null);
    setError(null);
    startScanner();
  };

  const handleClose = () => {
    stopScanner();
    setScannedItems([]);
    scannedIdsRef.current.clear();
    setTallyResult(null);
    setSeriesData(null);
    setError(null);
    onOpenChange(false);
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    }
  };

  const expectedItems = seriesData?.items || [];
  const totalExpected = seriesData?.stats?.total || expectedItems.length || 0;
  const inStockCount = seriesData?.stats?.inStock || 0;
  const soldCount = seriesData?.stats?.sold || 0;
  const scannedSet = new Set(scannedItems.map((item) => item.id));
  const foundSet = new Set((tallyResult?.found || []).map((item: any) => String(item._id)));
  const missingSet = new Set((tallyResult?.missing || []).map((item: any) => String(item._id)));
  const missingCount = tallyResult
    ? tallyResult.missing.length
    : Math.max(totalExpected - scannedSet.size, 0);

  const packetRows = expectedItems.map((item: any) => {
    const itemId = String(item._id);
    const status = tallyResult
      ? foundSet.has(itemId)
        ? 'found'
        : missingSet.has(itemId)
          ? 'missing'
          : 'pending'
      : scannedSet.has(itemId)
        ? 'found'
        : 'pending';

    return {
      item,
      status,
    };
  });

  if (!seriesData && loading) {
    return (
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={isMobile ? 'tally-container !w-screen !max-w-none !h-[100dvh] !m-0 !p-0 !rounded-none' : 'max-w-2xl'}>
          <DialogHeader>
            <DialogTitle>Loading Series Data...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile full-screen rendering
  if (isMobile && open) {
    return (
      <>
        <div className="fixed inset-0 bg-black z-[9998]" />
        <div className="fixed inset-0 z-[9999] flex flex-col bg-background overflow-hidden">
          {/* Fixed Header */}
          <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-background border-b z-[10001]">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 hover:bg-accent px-2 py-2 rounded-md transition"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-base font-semibold truncate px-2">Series: {seriesName}</p>
            <span className="w-12" />
          </div>

          {/* Stats Grid - Single Row */}
          <div className="fixed top-16 left-0 right-0 grid grid-cols-4 gap-2 px-3 py-2 bg-background border-b z-10000">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">{totalExpected}</p>
              <p className="text-xs text-slate-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{inStockCount}</p>
              <p className="text-xs text-slate-600">In Stock</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-500">{soldCount}</p>
              <p className="text-xs text-slate-600">Sold</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-600">{missingCount}</p>
              <p className="text-xs text-slate-600">Missing</p>
            </div>
          </div>

          {/* Camera View - Shows when scanning */}
          {!tallyResult && (
            <div className="fixed top-32 left-0 right-0 bottom-24 flex items-center justify-center bg-black">
              <div
                id="tally-qr-reader"
                className="absolute inset-0 w-full h-full"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[220px] h-[220px] rounded-2xl border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
              </div>
            </div>
          )}

          {/* Scrollable Packet List */}
          <div className="flex-1 mt-32 overflow-y-auto px-3 py-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">PACKETS ({packetRows.length})</p>
            {packetRows.length === 0 ? (
              <p className="text-xs text-slate-500">No packets for this series.</p>
            ) : (
              packetRows.map(({ item, status }: { item: any; status: string }) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between px-2 py-2 border-b border-slate-200 last:border-b-0"
                >
                  <span className="font-mono text-xs text-slate-900 flex-1 truncate">{item.serialNumber}</span>
                  <Badge
                    className={`flex-shrink-0 text-xs ${
                      status === 'found'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : status === 'missing'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    variant="outline"
                  >
                    {status === 'found' ? '✔' : status === 'missing' ? '✖' : '○'}
                  </Badge>
                </div>
              ))
            )}
          </div>

          {error && !tallyResult && (
            <div className="fixed bottom-24 left-0 right-0 mx-3 mb-2 flex gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {tallyResult && (
            <div className="fixed bottom-24 left-0 right-0 mx-3 mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-semibold text-sm text-green-900">✓ Tally Completed</p>
              <p className="text-xs text-green-700 mt-1">Accuracy: {tallyResult.accuracy}%</p>
            </div>
          )}

          {/* Fixed Bottom Button Bar */}
          <div className="fixed bottom-0 left-0 right-0 h-24 border-t bg-background px-3 py-3 z-10000">
            <div className="grid grid-cols-2 gap-2 h-full">
              <Button
                size="lg"
                className="h-16 bg-slate-900 text-white"
                onClick={tallyResult ? handleReset : startScanner}
              >
                <div className="text-center">
                  <div className="text-xs font-semibold">{tallyResult ? 'START' : 'SCAN'}</div>
                  <div className="text-xs">{tallyResult ? 'OVER' : 'PACKET'}</div>
                </div>
              </Button>
              <Button
                size="lg"
                variant={tallyResult ? 'outline' : 'default'}
                className={`h-16 ${!tallyResult && (scannedItems.length === 0 || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={tallyResult ? handleClose : processTally}
                disabled={!tallyResult && (scannedItems.length === 0 || loading)}
              >
                <div className="text-center">
                  <div className="text-xs font-semibold">{tallyResult ? 'CLOSE' : 'COMPLETE'}</div>
                  <div className="text-xs">{loading ? 'PROCESSING' : 'TALLY'}</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop dialog rendering
  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Series Tally: {seriesName}</DialogTitle>
          <DialogDescription>
            Expected: {totalExpected} items | Scanned: {scannedItems.length}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div
              id="tally-qr-reader"
              className="w-full rounded-md overflow-hidden bg-black min-h-[320px] border border-border"
            />
            {scanning && !error && (
              <p className="text-sm text-center text-muted-foreground">
                Scanning... Hold steady to scan items.
              </p>
            )}
            {error && (
              <div className="flex gap-3 p-3 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="p-3 border rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">Packets</h3>
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {packetRows.map(({ item, status }: { item: any; status: string }) => (
                  <div
                    key={item._id}
                    className="text-xs p-2 bg-background border rounded flex items-center justify-between gap-2"
                  >
                    <span className="font-mono truncate flex-1 min-w-0">{item.serialNumber}</span>
                    <Badge
                      variant="outline"
                      className={status === 'found'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : status === 'missing'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                        }
                    >
                      {status === 'found' ? 'Found' : status === 'missing' ? 'Missing' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div>Total: {totalExpected}</div>
                <div>In Stock: {inStockCount}</div>
                <div>Sold: {soldCount}</div>
                <div>Missing: {missingCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={startScanner}>Scan Next Packet</Button>
          <Button
            onClick={processTally}
            disabled={scannedItems.length === 0 || loading}
          >
            {loading ? 'Processing...' : 'Complete Tally'}
          </Button>
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
