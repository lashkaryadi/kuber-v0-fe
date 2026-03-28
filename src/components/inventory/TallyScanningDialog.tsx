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
import { Check, X, AlertCircle } from 'lucide-react';
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

  useEffect(() => {
    if (open) {
      loadSeriesData();
      startScanner();
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
      // Query the DOM element multiple times to ensure it exists
      let element = document.getElementById('tally-qr-reader');
      let attempts = 0;
      while (!element && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        element = document.getElementById('tally-qr-reader');
        attempts++;
      }

      if (!element) {
        throw new Error('QR reader element not found');
      }

      const scanner = new Html5Qrcode('tally-qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        (errorMessage: string) => {
          // Ignore "QR code not found" errors
          if (!errorMessage?.includes('NotFoundException')) {
            console.debug('Scan error:', errorMessage);
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

  if (!seriesData && loading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Series Tally: {seriesName}</DialogTitle>
          <DialogDescription>
            Expected: {seriesData?.stats?.total || 0} items | Scanned: {scannedItems.length}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scanner Section */}
          <div className="space-y-3">
            {tallyResult ? (
              // Show results instead of scanner
              <div className="space-y-3">
                <div className="p-3 border rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Tally Results</h3>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Found: {tallyResult.found.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-red-600" />
                      <span>Missing: {tallyResult.missing.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span>Extra: {tallyResult.extra.length}</span>
                    </div>
                    <div className="font-semibold">
                      Accuracy: {tallyResult.accuracy}%
                    </div>
                  </div>

                  {tallyResult.missing.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-red-600 mb-1">Missing Items:</p>
                      <div className="text-xs space-y-1">
                        {tallyResult.missing.slice(0, 3).map((item: any) => (
                          <div key={item._id} className="text-red-600">
                            • {item.serialNumber || item._id}
                          </div>
                        ))}
                        {tallyResult.missing.length > 3 && (
                          <div className="text-muted-foreground">
                            ... and {tallyResult.missing.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleReset}
                    className="w-full"
                    variant="outline"
                  >
                    Start Over
                  </Button>
                </div>
              </div>
            ) : (
              // Scanner view
              <div className="space-y-3">
                <div
                  id="tally-qr-reader"
                  className="w-full rounded-md overflow-hidden bg-black min-h-[300px] border border-border"
                />

                {/* Status Messages */}
                {scanning && !error && (
                  <p className="text-sm text-center text-muted-foreground">
                    Scanning... Hold steady to scan items
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
            )}
          </div>

          {/* Scanned Items List */}
          <div className="space-y-3">
            <div className="p-3 border rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">
                Scanned Items ({scannedItems.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {scannedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items scanned yet. Start scanning QR codes.
                  </p>
                ) : (
                  scannedItems.map((item, index) => (
                    <div
                      key={index}
                      className="text-xs p-2 bg-background border rounded flex items-center gap-2"
                    >
                      <Badge variant="outline" className="bg-blue-50">
                        {index + 1}
                      </Badge>
                      <span className="font-mono">{item.sn || item.id.substring(0, 8)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  onClick={processTally}
                  disabled={scannedItems.length === 0 || loading}
                  className="flex-1"
                >
                  {loading ? 'Processing...' : 'Complete Tally'}
                </Button>
                <Button
                  onClick={() => {
                    const removedId = scannedItems[scannedItems.length - 1]?.id;
                    if (removedId) {
                      scannedIdsRef.current.delete(removedId);
                      setScannedItems((prev) => prev.slice(0, -1));
                    }
                  }}
                  variant="outline"
                  disabled={scannedItems.length === 0}
                >
                  Undo
                </Button>
              </div>
            </div>

            {/* Expected Stats */}
            {seriesData && (
              <div className="p-3 border rounded-lg bg-muted text-sm">
                <h3 className="font-semibold mb-2">Expected Stats</h3>
                <div className="space-y-1 text-xs">
                  <div>Total: {seriesData.stats?.total || 0}</div>
                  <div>In Stock: {seriesData.stats?.inStock || 0}</div>
                  <div>Sold: {seriesData.stats?.sold || 0}</div>
                  <div>On Memo: {seriesData.stats?.onMemo || 0}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          {error && !tallyResult && (
            <Button
              variant="outline"
              onClick={startScanner}
            >
              Try Again
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {tallyResult ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
