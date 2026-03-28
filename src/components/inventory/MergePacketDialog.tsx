import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { toast } from 'sonner';
import api from '@/services/api';

interface MergePacketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceItem: InventoryItem;
  onSuccess: () => void;
}

interface MergeCandidate {
  _id: string;
  serialNumber: string;
  category?: { name: string };
  totalPieces: number;
  totalWeight: number;
  availablePieces: number;
  availableWeight: number;
  shapeType: string;
  singleShape?: string;
  shapes?: { shape: string; pieces: number; weight: number }[];
  status: string;
}

export const MergePacketDialog: React.FC<MergePacketDialogProps> = ({
  open,
  onOpenChange,
  sourceItem,
  onSuccess,
}) => {
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<MergeCandidate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (open && sourceItem) {
      fetchCandidates();
    }
  }, [open, sourceItem]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await api.getMergeCandidates(sourceItem._id);
      if (response.success) {
        setCandidates(response.data);
      } else {
        toast.error('Failed to fetch merge candidates');
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to fetch merge candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTarget = (candidate: MergeCandidate) => {
    setSelectedTarget(candidate);
    setShowConfirm(true);
  };

  const handleConfirmMerge = async () => {
    if (!selectedTarget) return;

    setMerging(true);
    try {
      const response = await api.mergePackets(sourceItem._id, selectedTarget._id);
      if (response.success) {
        toast.success(response.message || 'Packets merged successfully');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to merge packets');
      }
    } catch (error) {
      console.error('Error merging:', error);
      toast.error('Failed to merge packets');
    } finally {
      setMerging(false);
      setShowConfirm(false);
    }
  };

  const getShapeDisplay = (item: MergeCandidate) => {
    if (item.shapeType === 'single') return item.singleShape || 'N/A';
    return item.shapes?.map(s => s.shape).join(', ') || 'N/A';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Merge Packet</DialogTitle>
            <DialogDescription>
              Select a target packet to merge <strong>{sourceItem.serialNumber}</strong> into.
              The source packet will be deleted after merge.
            </DialogDescription>
          </DialogHeader>

          {/* Source packet info */}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-sm font-medium text-orange-800">Source (will be deleted)</p>
            <div className="text-sm mt-1 space-y-1">
              <p><strong>{sourceItem.serialNumber}</strong> - {sourceItem.category?.name || 'N/A'}</p>
              <p>Pieces: {sourceItem.totalPieces} | Weight: {(sourceItem.totalWeight || 0).toFixed(2)} ct</p>
            </div>
          </div>

          {/* Candidates list */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Select target packet (same category):</p>

            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && candidates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No eligible packets found in the same category
              </div>
            )}

            {!loading && candidates.map((candidate) => (
              <div
                key={candidate._id}
                className="p-3 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleSelectTarget(candidate)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{candidate.serialNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Shapes: {getShapeDisplay(candidate)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pieces: {candidate.availablePieces}/{candidate.totalPieces} |
                      Weight: {(candidate.availableWeight || 0).toFixed(2)}/{(candidate.totalWeight || 0).toFixed(2)} ct
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {candidate.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Merge</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data from{' '}
              <strong>{sourceItem.serialNumber}</strong> will be moved into{' '}
              <strong>{selectedTarget?.serialNumber}</strong>.{' '}
              The source packet will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMerge} disabled={merging}>
              {merging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {merging ? 'Merging...' : 'Confirm Merge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
