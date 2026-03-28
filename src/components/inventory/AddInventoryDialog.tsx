import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ShapeSelector } from './ShapeSelector';
import { CategorySelector } from './CategorySelector';
import { ImageUpload } from '@/components/common/ImageUpload';
import { InventoryItem, InventoryShape, CUTTING_STYLES, CuttingStyleCode } from '@/types/inventory';
import { toast } from 'sonner';
import api from '@/services/api';
import { Loader2, Plus, X } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
}

interface SeriesItem {
  _id: string;
  name: string;
}

interface AddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categories: Category[];
  editItem?: InventoryItem;
}

interface DimRange {
  length: string;
  width: string;
}

interface ShapeFormEntry {
  shape: string;
  pieces: number;
  weight: number;
  dimensionMin: DimRange;
  dimensionMax: DimRange;
}

interface FormData {
  category: string;
  cuttingStyle: CuttingStyleCode | '';
  series: string;
  shapeType: 'single' | 'mix';
  singleShape: string;
  shapes: ShapeFormEntry[];
  totalPieces: string;
  totalWeight: string;
  purchaseCode: string;
  saleCode: string;
  dimensions: {
    min: DimRange;
    max: DimRange;
    unit: 'mm' | 'cm';
  };
  certification: string;
  location: string;
  mineName: string;
  status: string;
  description: string;
  images: string[];
}

const emptyDimRange = (): DimRange => ({ length: '', width: '' });

export const AddInventoryDialog: React.FC<AddInventoryDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  categories,
  editItem
}) => {
  const [formData, setFormData] = useState<FormData>({
    category: '',
    cuttingStyle: '',
    series: '',
    shapeType: 'single',
    singleShape: '',
    shapes: [],
    totalPieces: '',
    totalWeight: '',
    purchaseCode: '',
    saleCode: '',
    dimensions: {
      min: emptyDimRange(),
      max: emptyDimRange(),
      unit: 'mm'
    },
    certification: '',
    location: '',
    mineName: '',
    status: 'in_stock',
    description: '',
    images: []
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [mineNames, setMineNames] = useState<string[]>([]);
  const [showNewMine, setShowNewMine] = useState(false);
  const [newMineName, setNewMineName] = useState('');

  // Ref to hold pending shape data for deferred injection
  const pendingShapeRef = useRef<{
    singleShape: string;
    shapes: ShapeFormEntry[];
  } | null>(null);

  // Fetch series list and mine names
  useEffect(() => {
    if (open) {
      fetchSeries();
      fetchMineNames();
    }
  }, [open]);

  const fetchSeries = async () => {
    const response = await api.getSeries({ limit: 100 });
    if (response.success) {
      setSeriesList(response.data);
    }
  };

  const fetchMineNames = async () => {
    const response = await api.getMineNames();
    if (response.success) {
      setMineNames(response.data);
    }
  };

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;
    const response = await api.createSeriesItem({ name: newSeriesName.trim() });
    if (response.success) {
      toast.success('Series created');
      setNewSeriesName('');
      setShowNewSeries(false);
      await fetchSeries();
      if (response.data?._id) {
        setFormData(prev => ({ ...prev, series: response.data._id }));
      }
    } else {
      toast.error(response.message || 'Failed to create series');
    }
  };

  // Reset or populate form when dialog opens/closes or editItem changes
  // CRITICAL: Two-phase population for edit mode.
  // Phase 1: Set everything EXCEPT shape values (lot type renders correct selector)
  // Phase 2: After lot type render completes, inject saved shape values
  useEffect(() => {
    if (open) {
      if (editItem) {
        // Phase 1: Set all fields, but leave shapes empty so ShapeSelector
        // mounts with the correct isSingleShape prop first
        const savedSingleShape = editItem.singleShape || '';
        const savedShapes = (editItem.shapes || []).map(s => ({
          shape: s.shape,
          pieces: s.pieces,
          weight: s.weight,
          dimensionMin: {
            length: String(s.dimensionMin?.length || ''),
            width: String(s.dimensionMin?.width || '')
          },
          dimensionMax: {
            length: String(s.dimensionMax?.length || ''),
            width: String(s.dimensionMax?.width || '')
          }
        }));

        // Store shape data for deferred injection
        pendingShapeRef.current = {
          singleShape: savedSingleShape,
          shapes: savedShapes,
        };

        setFormData({
          category: editItem.category?._id || '',
          cuttingStyle: editItem.cuttingStyle || '',
          series: editItem.series?._id || '',
          shapeType: editItem.shapeType,
          singleShape: '',   // intentionally empty — injected in Phase 2
          shapes: [],        // intentionally empty — injected in Phase 2
          totalPieces: String(editItem.totalPieces || ''),
          totalWeight: String(editItem.totalWeight || ''),
          purchaseCode: editItem.purchaseCode || '',
          saleCode: editItem.saleCode || '',
          dimensions: {
            min: {
              length: String(editItem.dimensions?.min?.length || ''),
              width: String(editItem.dimensions?.min?.width || '')
            },
            max: {
              length: String(editItem.dimensions?.max?.length || ''),
              width: String(editItem.dimensions?.max?.width || '')
            },
            unit: editItem.dimensions?.unit || 'mm'
          },
          certification: editItem.certification || '',
          location: editItem.location || '',
          mineName: editItem.mineName || '',
          status: editItem.status || 'in_stock',
          description: editItem.description || '',
          images: editItem.images || []
        });
      } else {
        pendingShapeRef.current = null;
        setFormData({
          category: '',
          cuttingStyle: '',
          series: '',
          shapeType: 'single',
          singleShape: '',
          shapes: [],
          totalPieces: '',
          totalWeight: '',
          purchaseCode: '',
          saleCode: '',
          dimensions: {
            min: emptyDimRange(),
            max: emptyDimRange(),
            unit: 'mm'
          },
          certification: '',
          location: '',
          mineName: '',
          status: 'in_stock',
          description: '',
          images: []
        });
      }
    }
  }, [open, editItem]);

  // Phase 2: After lot type has rendered and ShapeSelector has mounted,
  // inject the saved shape value so the field shows correctly.
  useEffect(() => {
    if (!pendingShapeRef.current) return;

    const pending = pendingShapeRef.current;
    pendingShapeRef.current = null;

    // Wait one frame so lot type conditional rendering is committed to DOM
    const rafId = requestAnimationFrame(() => {
      setFormData(prev => ({
        ...prev,
        singleShape: prev.shapeType === 'single' ? pending.singleShape : '',
        shapes: prev.shapeType === 'mix' ? pending.shapes : [],
      }));
    });

    return () => cancelAnimationFrame(rafId);
  }, [formData.shapeType, open]);

  const handleShapeTypeChange = (value: 'single' | 'mix') => {
    setFormData(prev => ({
      ...prev,
      shapeType: value,
      singleShape: value === 'single' ? prev.singleShape : '',
      shapes: value === 'mix' ? prev.shapes : [],
      totalPieces: value === 'mix' ? '' : prev.totalPieces,
      totalWeight: value === 'mix' ? '' : prev.totalWeight
    }));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const response = await api.uploadImage(file);
      if (response.data?.url) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, response.data!.url]
        }));
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Mix shape dimension handlers
  const updateShapeDimension = (
    shapeIndex: number,
    field: 'dimensionMin' | 'dimensionMax',
    subField: 'length' | 'width',
    value: string
  ) => {
    setFormData(prev => {
      const newShapes = [...prev.shapes];
      newShapes[shapeIndex] = {
        ...newShapes[shapeIndex],
        [field]: {
          ...newShapes[shapeIndex][field],
          [subField]: value
        }
      };
      return { ...prev, shapes: newShapes };
    });
  };

  const validateForm = (): boolean => {
    if (!formData.category) {
      toast.error('Please select a category');
      return false;
    }

    if (formData.shapeType === 'single') {
      if (!formData.singleShape) {
        toast.error('Please select a shape');
        return false;
      }
      if (!formData.totalWeight || parseFloat(formData.totalWeight) <= 0) {
        toast.error('Please enter valid total weight');
        return false;
      }
    } else {
      if (formData.shapes.length === 0) {
        toast.error('Please add at least one shape');
        return false;
      }
      for (const shape of formData.shapes) {
        if (!shape.shape) {
          toast.error('Please select a shape for all entries');
          return false;
        }
        if (shape.weight <= 0) {
          toast.error(`Please enter valid weight for ${shape.shape}`);
          return false;
        }
      }
    }

    // Validate dimension min <= max
    if (formData.shapeType === 'single') {
      const minL = parseFloat(formData.dimensions.min.length) || 0;
      const maxL = parseFloat(formData.dimensions.max.length) || 0;
      const minW = parseFloat(formData.dimensions.min.width) || 0;
      const maxW = parseFloat(formData.dimensions.max.width) || 0;
      if ((maxL > 0 && minL > maxL) || (maxW > 0 && minW > maxW)) {
        toast.error('Dimension min values cannot be greater than max values');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const derivedTotals =
        formData.shapeType === 'mix'
          ? {
              totalPieces: formData.shapes.reduce((s, x) => s + (x.pieces || 0), 0),
              totalWeight: formData.shapes.reduce((s, x) => s + x.weight, 0),
            }
          : {
              totalPieces: parseFloat(formData.totalPieces) || 0,
              totalWeight: parseFloat(formData.totalWeight) || 0,
            };

      const submitData = {
        category: formData.category || null,
        cuttingStyle: formData.cuttingStyle || '',
        series: formData.series || null,
        shapeType: formData.shapeType,

        singleShape:
          formData.shapeType === 'single' ? formData.singleShape : null,

        shapes:
          formData.shapeType === 'mix'
            ? formData.shapes.map(s => ({
                shape: s.shape,
                pieces: s.pieces || 0,
                weight: s.weight,
                dimensionMin: {
                  length: parseFloat(s.dimensionMin.length) || 0,
                  width: parseFloat(s.dimensionMin.width) || 0
                },
                dimensionMax: {
                  length: parseFloat(s.dimensionMax.length) || 0,
                  width: parseFloat(s.dimensionMax.width) || 0
                }
              }))
            : [],

        totalPieces: derivedTotals.totalPieces,
        totalWeight: derivedTotals.totalWeight,

        purchaseCode: formData.purchaseCode,
        saleCode: formData.saleCode,

        dimensions: {
          min: {
            length: parseFloat(formData.dimensions.min.length) || 0,
            width: parseFloat(formData.dimensions.min.width) || 0
          },
          max: {
            length: parseFloat(formData.dimensions.max.length) || 0,
            width: parseFloat(formData.dimensions.max.width) || 0
          },
          unit: formData.dimensions.unit,
        },

        certification: formData.certification,
        location: formData.location,
        mineName: formData.mineName,
        status: formData.status,
        description: formData.description,
        images: formData.images,
      };

      let response;
      if (editItem) {
        response = await api.updateInventoryItem(editItem._id, submitData);
      } else {
        response = await api.createInventoryItem(submitData);
      }

      if (response.success) {
        toast.success(editItem ? 'Item updated successfully' : 'Item added successfully');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to save item');
      }
    } catch (error: unknown) {
      console.error('Error saving item:', error);
      toast.error((error as Error)?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
          </DialogTitle>
          <DialogDescription>
            {editItem
              ? 'Edit inventory details like category, shape, weight and location.'
              : 'Add inventory details like category, shape, weight and location.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Serial Number Info */}
          {editItem && (
            <div className="p-3 bg-muted/50 rounded-md border">
              <Label className="text-sm font-medium">Serial Number</Label>
              <p className="text-lg font-semibold">{editItem.serialNumber}</p>
              <p className="text-xs text-muted-foreground">Serial numbers cannot be changed</p>
            </div>
          )}

          {!editItem && (
            <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
              <p className="text-sm text-muted-foreground">
                Serial number will be auto-generated: #[Category Code][Cutting Style][Sequence]
              </p>
            </div>
          )}

          {/* Category Selection */}
          <div>
            <Label htmlFor="category">Category *</Label>
            <CategorySelector
              categories={categories}
              value={formData.category}
              onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              onCreateCategory={async () => {}}
              placeholder="Select a category..."
            />
          </div>

          {/* Cutting Style Selection */}
          <div>
            <Label htmlFor="cuttingStyle">Cutting Style</Label>
            <select
              id="cuttingStyle"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              value={formData.cuttingStyle}
              onChange={(e) => setFormData(prev => ({ ...prev, cuttingStyle: e.target.value as CuttingStyleCode | '' }))}
              aria-label="Cutting style"
            >
              <option value="">Select cutting style...</option>
              {Object.entries(CUTTING_STYLES).map(([code, name]) => (
                <option key={code} value={code}>{code} - {name}</option>
              ))}
            </select>
          </div>

          {/* Series Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="series">Series</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowNewSeries(!showNewSeries)}
              >
                <Plus className="w-3 h-3 mr-1" />
                New Series
              </Button>
            </div>
            {showNewSeries && (
              <div className="flex gap-2 mb-2">
                <Input
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  placeholder="Series name"
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={handleCreateSeries}>
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewSeries(false); setNewSeriesName(''); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <select
              id="series"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              value={formData.series}
              onChange={(e) => setFormData(prev => ({ ...prev, series: e.target.value }))}
              aria-label="Series"
            >
              <option value="">No series</option>
              {seriesList.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Shape Type Selection */}
          <div className="space-y-4">
            <Label>Lot Type *</Label>
            <RadioGroup
              value={formData.shapeType}
              onValueChange={handleShapeTypeChange}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="font-normal cursor-pointer">
                  Single Shape Lot
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mix" id="mix" />
                <Label htmlFor="mix" className="font-normal cursor-pointer">
                  Mix Shape Lot
                </Label>
              </div>
            </RadioGroup>

            {/* Shape Selector */}
            <div className="pt-2">
              <ShapeSelector
                shapes={
                  formData.shapeType === 'single'
                    ? formData.singleShape
                      ? [{ shape: formData.singleShape, pieces: 1, weight: 0 }]
                      : []
                    : formData.shapes.map(s => ({ shape: s.shape, pieces: s.pieces, weight: s.weight }))
                }
                onChange={(shapes) => {
                  if (formData.shapeType === 'single') {
                    setFormData(prev => ({
                      ...prev,
                      singleShape: shapes[0]?.shape || ''
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      shapes: shapes.map((s, i) => ({
                        shape: s.shape,
                        pieces: s.pieces,
                        weight: s.weight,
                        dimensionMin: prev.shapes[i]?.dimensionMin || emptyDimRange(),
                        dimensionMax: prev.shapes[i]?.dimensionMax || emptyDimRange()
                      }))
                    }));
                  }
                }}
                isSingleShape={formData.shapeType === 'single'}
              />
            </div>
          </div>

          {/* Quantity and Weight (Only for single shape) */}
          {formData.shapeType === 'single' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="totalPieces">Total Pieces</Label>
                <Input
                  id="totalPieces"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.totalPieces}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalPieces: e.target.value }))}
                  placeholder="Enter total pieces (optional)"
                />
              </div>
              <div>
                <Label htmlFor="totalWeight">Total Weight (carats) *</Label>
                <Input
                  id="totalWeight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.totalWeight}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalWeight: e.target.value }))}
                  placeholder="Enter total weight"
                />
              </div>
            </div>
          )}

          {/* Mix Shapes Info */}
          {formData.shapeType === 'mix' && formData.shapes.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-md border">
              <p className="text-sm font-medium mb-1">Total Summary</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Pieces: </span>
                  <span className="font-semibold">
                    {formData.shapes.reduce((sum, s) => sum + (s.pieces || 0), 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Weight: </span>
                  <span className="font-semibold">
                    {formData.shapes.reduce((sum, s) => sum + s.weight, 0).toFixed(2)} ct
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Dimension Range — Single Shape Lot */}
          {formData.shapeType === 'single' && (
            <div>
              <Label>Dimension Range (optional)</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Min (L x W)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Length"
                      value={formData.dimensions.min.length}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          min: { ...prev.dimensions.min, length: e.target.value }
                        }
                      }))}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Width"
                      value={formData.dimensions.min.width}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          min: { ...prev.dimensions.min, width: e.target.value }
                        }
                      }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Max (L x W)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Length"
                      value={formData.dimensions.max.length}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          max: { ...prev.dimensions.max, length: e.target.value }
                        }
                      }))}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Width"
                      value={formData.dimensions.max.width}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        dimensions: {
                          ...prev.dimensions,
                          max: { ...prev.dimensions.max, width: e.target.value }
                        }
                      }))}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2 w-24">
                <select
                  className="w-full px-2 py-1 border border-input rounded-md bg-background text-sm"
                  value={formData.dimensions.unit}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, unit: e.target.value as 'mm' | 'cm' }
                  }))}
                  aria-label="Dimension unit"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>
          )}

          {/* Dimension Range — Mix Shape Lot (per shape) */}
          {formData.shapeType === 'mix' && formData.shapes.length > 0 && (
            <div className="space-y-4">
              <Label>Dimension Range per Shape (optional)</Label>
              {formData.shapes.map((shape, idx) => (
                <div key={idx} className="p-3 border rounded-md space-y-2">
                  <p className="text-sm font-medium">{shape.shape || `Shape ${idx + 1}`}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Min (L x W)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Length"
                          value={shape.dimensionMin.length}
                          onChange={(e) => updateShapeDimension(idx, 'dimensionMin', 'length', e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Width"
                          value={shape.dimensionMin.width}
                          onChange={(e) => updateShapeDimension(idx, 'dimensionMin', 'width', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Max (L x W)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Length"
                          value={shape.dimensionMax.length}
                          onChange={(e) => updateShapeDimension(idx, 'dimensionMax', 'length', e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Width"
                          value={shape.dimensionMax.width}
                          onChange={(e) => updateShapeDimension(idx, 'dimensionMax', 'width', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pricing Codes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchaseCode">Purchase Code</Label>
              <Input
                id="purchaseCode"
                value={formData.purchaseCode}
                onChange={(e) => setFormData(prev => ({ ...prev, purchaseCode: e.target.value }))}
                placeholder="Enter purchase code"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Numeric or text code for internal tracking
              </p>
            </div>
            <div>
              <Label htmlFor="saleCode">Sale Code</Label>
              <Input
                id="saleCode"
                value={formData.saleCode}
                onChange={(e) => setFormData(prev => ({ ...prev, saleCode: e.target.value }))}
                placeholder="Enter sale code"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Numeric = price/carat | Text = confidential
              </p>
            </div>
          </div>

          {/* Certification & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="certification">Certification</Label>
              <Input
                id="certification"
                value={formData.certification}
                onChange={(e) => setFormData(prev => ({ ...prev, certification: e.target.value }))}
                placeholder="e.g., GIA, IGI"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., New York, Mumbai"
              />
            </div>
          </div>

          {/* Mine / Source */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="mineName">Mine / Source</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowNewMine(!showNewMine)}
              >
                <Plus className="w-3 h-3 mr-1" />
                New Mine
              </Button>
            </div>
            {showNewMine && (
              <div className="flex gap-2 mb-2">
                <Input
                  value={newMineName}
                  onChange={(e) => setNewMineName(e.target.value)}
                  placeholder="Mine name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const name = newMineName.trim();
                    if (!name) return;
                    if (!mineNames.includes(name)) {
                      setMineNames(prev => [...prev, name].sort());
                    }
                    setFormData(prev => ({ ...prev, mineName: name }));
                    setNewMineName('');
                    setShowNewMine(false);
                  }}
                >
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewMine(false); setNewMineName(''); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <select
              id="mineName"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              value={formData.mineName}
              onChange={(e) => setFormData(prev => ({ ...prev, mineName: e.target.value }))}
              aria-label="Mine name"
            >
              <option value="">No mine selected</option>
              {mineNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              {formData.mineName && !mineNames.includes(formData.mineName) && (
                <option value={formData.mineName}>{formData.mineName}</option>
              )}
            </select>
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              aria-label="Item status"
            >
              <option value="in_stock">In Stock</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Additional notes about this item..."
            />
          </div>

          {/* Image Upload */}
          <div>
            <Label>Images</Label>
            <ImageUpload
              images={formData.images}
              onUpload={handleImageUpload}
              onRemove={handleRemoveImage}
              uploading={uploading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Saving...' : (editItem ? 'Update Item' : 'Add Item')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
