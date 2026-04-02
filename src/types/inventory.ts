export interface Category {
  _id: string;
  name: string;
  code?: string;
}

export interface Series {
  _id: string;
  name: string;
}

export interface ShapeDimension {
  length: number;
  width: number;
}

export interface InventoryShape {
  shape: string;
  pieces: number;
  weight: number;
  dimensionMin?: ShapeDimension;
  dimensionMax?: ShapeDimension;
}

export interface DimensionRange {
  min: ShapeDimension;
  max: ShapeDimension;
  unit: 'mm' | 'cm';
}

// Cutting style codes
export const CUTTING_STYLES = {
  A: 'Carving',
  B: 'Beads / Mani / Melon / Pochi',
  C: 'Cabs',
  D: 'Drops',
  E: 'Cut Stone',
  F: 'Carving Drops',
  L: 'Leaf'
} as const;

export type CuttingStyleCode = keyof typeof CUTTING_STYLES;

export interface InventoryItem {
  _id: string;
  serialNumber: string;

  category?: Category | null;
  series?: Series | null;

  shapeType: 'single' | 'mix';
  singleShape?: string | null;
  shapes?: InventoryShape[];

  totalPieces: number;
  totalWeight: number;

  lines?: number | null;
  grossWeight?: number | null;

  availablePieces: number;
  availableWeight: number;

  purchaseCode?: string;
  saleCode?: string;

  totalPrice?: number;

  cuttingStyle?: CuttingStyleCode | '';

  dimensions?: DimensionRange;

  certification?: string;
  location?: string;

  mine?: boolean;  // @deprecated — kept for backward compat with old data
  mineName?: string;

  status: 'in_stock' | 'pending' | 'partially_sold' | 'sold';

  description?: string;
  images?: string[];

  displayShapes?: string[];

  createdAt?: string;
  updatedAt?: string;
}
