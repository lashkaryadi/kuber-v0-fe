import axios, { AxiosError } from "axios";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

const BASE_URL = import.meta.env.VITE_API_URL ;

const isElectronUserAgent = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.userAgent === "string" &&
  /electron/i.test(navigator.userAgent);

const isElectronRuntime = () =>
  typeof window !== "undefined" &&
  (
    typeof window.electronAPI?.invoke === "function" ||
    typeof window.electronAPI?.auth?.signin === "function"
  );

const invokeElectron = async <T = any>(channel: string, payload?: any): Promise<T> => {
  if (!isElectronRuntime()) {
    throw new Error("Electron IPC is not available in this runtime");
  }
  return window.electronAPI!.invoke<T>(channel, payload);
};

const fileToBytes = async (file: File) => {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
};

const blobToBytes = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
};

const downloadBlobInBrowser = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const saveBytesToDesktop = async (payload: {
  title: string;
  defaultFileName: string;
  bytes: number[];
  filters: Array<{ name: string; extensions: string[] }>;
}) => {
  if (typeof window.electronAPI?.files?.save === "function") {
    return window.electronAPI.files.save(payload);
  }
  return invokeElectron("files:save", payload);
};

const emitDesktopDataChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kuber-data-changed"));
  }
};

const getFirstDefined = (...values: any[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const toFiniteNumber = (value: any, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFiniteInteger = (value: any, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getReferenceId = (value: any): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  const candidate = value?._id || value?.id;
  if (candidate === null || candidate === undefined) {
    return "";
  }

  return String(candidate).trim();
};

const getReferenceName = (value: any): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return "";
  }

  const candidate = value?.name;
  return candidate === null || candidate === undefined ? "" : String(candidate).trim();
};

const getCategoryId = (item: any) => getReferenceId(item?.category);
const getCategoryName = (item: any) => getReferenceName(item?.category) || getReferenceId(item?.category);
const getSeriesId = (item: any) => getReferenceId(item?.series);
const getSeriesName = (item: any) => getReferenceName(item?.series) || getReferenceId(item?.series);
const formatDimensions = (dim: any): string => {
  if (!dim) return "N/A";
  const length = Number(dim.length || 0).toFixed(2);
  const width = Number(dim.width || 0).toFixed(2);
  if (length === "0.00" && width === "0.00") return "N/A";
  return `${length}x${width}`;
};
const getShapeNames = (item: any) => {
  const shapes = Array.isArray(item?.shapes) ? item.shapes.map((s: any) => s?.shape).filter(Boolean) : [];
  if (item?.singleShape) {
    shapes.push(item.singleShape);
  }
  return shapes;
};

const buildReferenceNameMap = (rows: any[]): Map<string, string> => {
  const map = new Map<string, string>();

  for (const row of rows) {
    const id = getReferenceId(row);
    const name = getReferenceName(row);
    if (id && name && !map.has(id)) {
      map.set(id, name);
    }
  }

  return map;
};

const getDesktopReferenceMaps = async () => {
  const [categoriesResult, seriesResult] = await Promise.allSettled([
    invokeElectron<any>("categories:getAll", { page: 1, limit: 5000 }),
    invokeElectron<any>("series:getAll", { page: 1, limit: 5000 }),
  ]);

  const categoriesResponse = categoriesResult.status === "fulfilled" ? categoriesResult.value : null;
  const seriesResponse = seriesResult.status === "fulfilled" ? seriesResult.value : null;

  return {
    categoryNames: buildReferenceNameMap(Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : []),
    seriesNames: buildReferenceNameMap(Array.isArray(seriesResponse?.data) ? seriesResponse.data : []),
  };
};

const normalizeDesktopStatus = (value: any) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["in_stock", "pending", "partially_sold", "sold"].includes(normalized)) {
    return normalized;
  }

  if (normalized === "instock") {
    return "in_stock";
  }
  if (["partial", "partiallysold"].includes(normalized)) {
    return "partially_sold";
  }

  return "in_stock";
};

const deriveDesktopStatus = (
  status: any,
  totalPieces: number,
  totalWeight: number,
  availablePieces: number,
  availableWeight: number
) => {
  const normalized = normalizeDesktopStatus(status);

  if ((totalPieces > 0 || totalWeight > 0) && availablePieces <= 0 && availableWeight <= 0) {
    return "sold";
  }

  if (availablePieces < totalPieces || availableWeight < totalWeight) {
    return normalized === "pending" ? "pending" : "partially_sold";
  }

  return normalized === "pending" ? "pending" : "in_stock";
};

const buildDesktopSerialNumber = (item: any, category: any) => {
  const explicit = String(item?.serialNumber || item?.serial_number || item?.serial || "").trim();
  if (explicit) {
    return explicit;
  }

  const categoryToken = String(category?.name || category?.code || "GEN")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3) || "GEN";
  const styleToken = String(item?.cuttingStyle || item?.cutting_style || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 1);
  const idToken = String(item?._id || item?.id || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(-4)
    .padStart(4, "0");

  return `#${categoryToken}${styleToken}${idToken}`;
};

const normalizeDesktopReference = (value: any, nameLookup?: Map<string, string>) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const lookedUpName = String(nameLookup?.get(trimmed) || "").trim();
    return {
      _id: trimmed,
      id: trimmed,
      name: lookedUpName,
    };
  }

  const id = value?._id || value?.id;
  if (!id) {
    return null;
  }

  const normalizedId = String(id);
  const resolvedName = String(value?.name || nameLookup?.get(normalizedId) || "").trim();
  return {
    ...value,
    _id: normalizedId,
    id: normalizedId,
    name: resolvedName,
  };
};

const normalizeDesktopInventoryItem = (
  item: any,
  options?: {
    categoryNames?: Map<string, string>;
    seriesNames?: Map<string, string>;
  }
) => {
  const shapeTypeRaw = String(getFirstDefined(item?.shapeType, item?.shape_type, "single"))
    .trim()
    .toLowerCase();
  const shapeType = shapeTypeRaw === "mix" ? "mix" : "single";
  const rawShapes = Array.isArray(item?.shapes)
    ? item.shapes
    : Array.isArray(item?.shape_breakdown)
      ? item.shape_breakdown
      : [];

  const normalizedShapes = rawShapes.map((shape: any) => ({
    ...shape,
    shape: String(getFirstDefined(shape?.shape, shape?.shapeName, shape?.shape_name) || ""),
    pieces: Math.max(0, toFiniteInteger(getFirstDefined(shape?.pieces, shape?.pieces_total), 0)),
    weight: Math.max(0, toFiniteNumber(getFirstDefined(shape?.weight, shape?.weight_total), 0)),
  }));

  const piecesFromShapes = normalizedShapes.reduce((sum: number, shape: any) => sum + (shape?.pieces || 0), 0);
  const weightFromShapes = normalizedShapes.reduce((sum: number, shape: any) => sum + (shape?.weight || 0), 0);

  const totalPiecesValue = getFirstDefined(
    item?.totalPieces,
    item?.total_pieces,
    item?.piecesTotal,
    item?.pieces_total
  );
  const totalWeightValue = getFirstDefined(
    item?.totalWeight,
    item?.total_weight,
    item?.weightTotal,
    item?.weight_total
  );
  const availablePiecesValue = getFirstDefined(
    item?.availablePieces,
    item?.available_pieces,
    item?.piecesAvailable,
    item?.pieces_available
  );
  const availableWeightValue = getFirstDefined(
    item?.availableWeight,
    item?.available_weight,
    item?.weightAvailable,
    item?.weight_available
  );

  const totalPieces = Math.max(
    0,
    toFiniteInteger(totalPiecesValue, shapeType === "mix" ? piecesFromShapes : 0)
  );
  const totalWeight = Math.max(
    0,
    toFiniteNumber(totalWeightValue, shapeType === "mix" ? weightFromShapes : 0)
  );

  const availablePieces = Math.max(
    0,
    toFiniteInteger(availablePiecesValue, totalPieces)
  );
  const availableWeight = Math.max(
    0,
    toFiniteNumber(availableWeightValue, totalWeight)
  );

  const clampedAvailablePieces = totalPieces > 0 ? Math.min(availablePieces, totalPieces) : availablePieces;
  const clampedAvailableWeight = totalWeight > 0 ? Math.min(availableWeight, totalWeight) : availableWeight;

  const normalizedId = String(item?._id || item?.id || "");
  const category = normalizeDesktopReference(
    item?.category || item?.categoryId || item?.category_id,
    options?.categoryNames
  );
  const series = normalizeDesktopReference(
    item?.series || item?.seriesId || item?.series_id,
    options?.seriesNames
  );

  return {
    ...item,
    _id: normalizedId,
    id: normalizedId,
    shapeType,
    singleShape: String(getFirstDefined(item?.singleShape, item?.single_shape) || "").trim() || null,
    category,
    series,
    shapes: normalizedShapes,
    totalPieces,
    totalWeight,
    availablePieces: clampedAvailablePieces,
    availableWeight: clampedAvailableWeight,
    purchaseCode: String(getFirstDefined(item?.purchaseCode, item?.purchase_code) || ""),
    saleCode: String(getFirstDefined(item?.saleCode, item?.sale_code) || ""),
    purchasePrice: getFirstDefined(item?.purchasePrice, item?.purchase_price),
    salePrice: getFirstDefined(item?.salePrice, item?.sale_price),
    mineName: String(getFirstDefined(item?.mineName, item?.mine_name, item?.mineSource, item?.mine_source) || ""),
    certification: String(getFirstDefined(item?.certification, item?.certificate) || ""),
    createdAt: String(getFirstDefined(item?.createdAt, item?.created_at) || item?.createdAt || ""),
    updatedAt: String(getFirstDefined(item?.updatedAt, item?.updated_at) || item?.updatedAt || ""),
    serialNumber: buildDesktopSerialNumber(item, category),
    status: deriveDesktopStatus(item?.status, totalPieces, totalWeight, clampedAvailablePieces, clampedAvailableWeight),
  };
};

const normalizeDesktopSaleItem = (sale: any) => {
  const normalizedId = String(sale?._id || sale?.id || "");
  const soldAt = sale?.soldAt || sale?.soldDate || sale?.createdAt || new Date().toISOString();
  const soldShapes = Array.isArray(sale?.soldShapes)
    ? sale.soldShapes.map((shape: any) => ({
        shape: String(shape?.shape || shape?.shapeName || ""),
        pieces: Number(shape?.pieces || 0),
        weight: Number(shape?.weight || 0),
        pricePerCarat: Number(shape?.pricePerCarat || 0),
        lineTotal: Number(shape?.lineTotal || 0),
      }))
    : [];

  const totalPieces = Number(sale?.totalPieces || soldShapes.reduce((sum, shape) => sum + shape.pieces, 0));
  const totalWeight = Number(sale?.totalWeight || soldShapes.reduce((sum, shape) => sum + shape.weight, 0));
  const totalAmount = Number(sale?.totalAmount || soldShapes.reduce((sum, shape) => sum + shape.lineTotal, 0));

  return {
    ...sale,
    _id: normalizedId,
    id: normalizedId,
    soldAt,
    soldDate: soldAt,
    soldShapes,
    totalPieces,
    totalWeight,
    totalAmount,
    inventoryItem: sale?.inventoryItem ? normalizeDesktopInventoryItem(sale.inventoryItem) : null,
    customer: sale?.customer || {},
    cancelled: Boolean(sale?.cancelled),
    price: totalAmount,
    buyer: sale?.customer?.name || sale?.buyer || "Walk-in",
  };
};

const sortInventoryForExport = (items: any[], sortBy?: string, sortOrder?: "asc" | "desc") => {
  if (!sortBy) {
    return items;
  }

  const dir = sortOrder === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a?.[sortBy] ?? "";
    const bv = b?.[sortBy] ?? "";

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }

    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
};

const filterInventoryForExport = (items: any[], params: Record<string, any> = {}) => {
  return items.filter((item) => {
    const search = String(params.search || "").trim().toLowerCase();
    if (search && !JSON.stringify(item).toLowerCase().includes(search)) {
      return false;
    }

    if (params.category && params.category !== "ALL") {
      const categoryId = String(getCategoryId(item));
      const categoryName = String(getCategoryName(item));
      if (categoryId !== String(params.category) && categoryName !== String(params.category)) {
        return false;
      }
    }

    if (params.status && params.status !== "All Status" && String(item?.status || "") !== String(params.status)) {
      return false;
    }

    if (params.shape && params.shape !== "ALL") {
      const itemShapes = getShapeNames(item);
      if (!itemShapes.includes(String(params.shape))) {
        return false;
      }
    }

    if (params.cuttingStyle && params.cuttingStyle !== "ALL" && String(item?.cuttingStyle || "") !== String(params.cuttingStyle)) {
      return false;
    }

    if (params.series && params.series !== "ALL") {
      const seriesId = String(getSeriesId(item));
      if (seriesId !== String(params.series)) {
        return false;
      }
    }

    if (params.lotType && params.lotType !== "ALL" && String(item?.lotType || "") !== String(params.lotType)) {
      return false;
    }

    const totalWeight = Number(item?.totalWeight || 0);
    const totalPieces = Number(item?.totalPieces || 0);

    if (params.minWeight !== undefined && params.minWeight !== "" && totalWeight < Number(params.minWeight)) {
      return false;
    }
    if (params.maxWeight !== undefined && params.maxWeight !== "" && totalWeight > Number(params.maxWeight)) {
      return false;
    }
    if (params.minPieces !== undefined && params.minPieces !== "" && totalPieces < Number(params.minPieces)) {
      return false;
    }
    if (params.maxPieces !== undefined && params.maxPieces !== "" && totalPieces > Number(params.maxPieces)) {
      return false;
    }

    return true;
  });
};

const getDesktopInventoryForExport = async (params?: Record<string, any>) => {
  const [response, references] = await Promise.all([
    invokeElectron<any>("inventory:getAll", {
      page: 1,
      limit: 100000,
      search: params?.search || "",
    }),
    getDesktopReferenceMaps(),
  ]);

  const rawItems = Array.isArray(response?.data) ? response.data : [];
  const normalizedItems = rawItems.map((item: any) => normalizeDesktopInventoryItem(item, references));
  const filtered = filterInventoryForExport(normalizedItems, params || {});
  return sortInventoryForExport(filtered, params?.sortBy, params?.sortOrder);
};

const buildEmptyAnalytics = () => ({
  totals: {
    revenue: 0,
    totalWeight: 0,
    totalPieces: 0,
    count: 0,
  },
  monthly: [],
  categories: [],
  customers: [],
  inventoryStats: [],
});

const buildDesktopAnalytics = async () => {
  const [inventoryResponse, soldResponse] = await Promise.all([
    invokeElectron<any>("inventory:getAll", { page: 1, limit: 100000 }),
    invokeElectron<any>("sold:getAll", { page: 1, limit: 100000 }),
  ]);

  const inventoryItems = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : [];
  const soldItems = Array.isArray(soldResponse?.data) ? soldResponse.data : [];

  const totals = {
    revenue: 0,
    totalWeight: 0,
    totalPieces: 0,
    count: 0,
  };

  const monthlyMap = new Map<string, { month: string; revenue: number; count: number; weight: number }>();
  const categoryMap = new Map<string, { _id: string; revenue: number; count: number; weight: number }>();
  const customerMap = new Map<string, { _id: string; revenue: number; count: number }>();
  const inventoryStatsMap = new Map<string, { _id: string; count: number; totalWeight: number; totalPieces: number }>();

  for (const item of inventoryItems) {
    const status = String(item?.status || "unknown");
    const entry = inventoryStatsMap.get(status) || {
      _id: status,
      count: 0,
      totalWeight: 0,
      totalPieces: 0,
    };
    entry.count += 1;
    entry.totalWeight += Number(item?.totalWeight || 0);
    entry.totalPieces += Number(item?.totalPieces || 0);
    inventoryStatsMap.set(status, entry);
  }

  for (const sale of soldItems) {
    const amount = Number(sale?.totalAmount || sale?.lineTotal || sale?.price || 0);
    const weight = Number(sale?.totalWeight || sale?.soldWeight || 0);
    const pieces = Number(sale?.totalPieces || sale?.soldPieces || 0);

    totals.revenue += amount;
    totals.totalWeight += weight;
    totals.totalPieces += pieces;
    totals.count += 1;

    const saleDate = sale?.soldDate || sale?.soldAt || sale?.createdAt;
    const date = saleDate ? new Date(saleDate) : null;
    const monthKey = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : "Unknown";
    const monthEntry = monthlyMap.get(monthKey) || { month: monthKey, revenue: 0, count: 0, weight: 0 };
    monthEntry.revenue += amount;
    monthEntry.count += 1;
    monthEntry.weight += weight;
    monthlyMap.set(monthKey, monthEntry);

    const categoryKey = String(
      sale?.inventoryItem?.category?.name ||
      sale?.inventoryItem?.category ||
      sale?.category ||
      "Unknown"
    );
    const categoryEntry = categoryMap.get(categoryKey) || { _id: categoryKey, revenue: 0, count: 0, weight: 0 };
    categoryEntry.revenue += amount;
    categoryEntry.count += 1;
    categoryEntry.weight += weight;
    categoryMap.set(categoryKey, categoryEntry);

    const customerKey = String(
      sale?.customer?.name || sale?.customer?.email || sale?.buyer || "Unknown"
    );
    const customerEntry = customerMap.get(customerKey) || { _id: customerKey, revenue: 0, count: 0 };
    customerEntry.revenue += amount;
    customerEntry.count += 1;
    customerMap.set(customerKey, customerEntry);
  }

  return {
    totals,
    monthly: Array.from(monthlyMap.values()),
    categories: Array.from(categoryMap.values()),
    customers: Array.from(customerMap.values()),
    inventoryStats: Array.from(inventoryStatsMap.values()),
  };
};

/* ============================
   TYPES
============================ */
export interface User {
  _id?: string;
  id?: string;
  name?: string;
  username: string;
  email: string;
  role: "admin" | "staff";
  createdAt?: string;
}

export interface RecycleBinItem {
  id: string;
  entityType: "inventory" | "category";
  entityId: string;
  entityData: any;
  deletedBy: {
    username?: string;
    email?: string;
  };
  deletedAt: string;
  expiresAt: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  _id: string;
  name: string;
  description?: string;
  createdAt?: string;
  isDeleted?: boolean;
}

export interface InventoryItem {
  _id: string;
  id?: string;
  serialNumber: string;
  category: Category | string;
  shapeType: "single" | "mix";
  singleShape?: string;
  shapes: Array<{ shape: string; pieces: number; weight: number }>;
  totalPieces: number;
  totalWeight: number;
  availablePieces: number;
  availableWeight: number;
  purchaseCode?: string;
  saleCode?: string;
  totalPrice?: number;
  dimensions?: { length: number; width: number; height: number; unit: string };
  certification?: string;
  location?: string;
  status: "in_stock" | "pending" | "partially_sold" | "sold";
  description?: string;
  images?: string[];
  weightUnit?: string;
  pieces?: number;
  weight?: number;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SoldItem {
  _id: string;
  id: string;
  inventoryId: any;
  inventoryItem: any;
  soldShapes: Array<{
    shape: string;
    pieces: number;
    weight: number;
    pricePerCarat: number;
    lineTotal: number;
  }>;
  totalPieces: number;
  totalWeight: number;
  totalAmount: number;
  customer: { name?: string; email?: string; phone?: string };
  invoiceNumber?: string;
  saleRef?: string;
  soldAt: string;
  soldDate: string;
  cancelled: boolean;
  cancelledAt?: string;
  cancelledBy?: any;
  cancelReason?: string;
  ownerId: string;
  createdAt: string;
  // Legacy compatibility
  price: number;
  currency: string;
  buyer: string;
  soldPieces?: number;
  soldWeight?: number;
}

export interface DashboardStats {
  totalInventory: number;
  in_stockItems: number;
  soldItems: number;
  pendingApproval: number;
  partiallySoldItems: number;
  totalValue: number;
  inStockValue: number | string;
  totalWeight: number;
  totalPieces: number;
  totalSalesAmount: number;
  recentSales: SoldItem[];
}

/* ============================
   AXIOS INSTANCE
============================ */
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

/* ============================
   TOKEN HELPERS
============================ */
const getToken = () => localStorage.getItem("accessToken") || localStorage.getItem("token");

const setToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
  }
};

const createAuthError = (message: string) => {
  const error: any = new Error(message);
  error.response = { data: { message } };
  return error;
};

const normalizeUser = (rawUser: any): User => {
  const normalizedId = rawUser?.id ?? rawUser?._id;
  const username = rawUser?.username || rawUser?.name || "";

  return {
    ...rawUser,
    id: normalizedId !== undefined && normalizedId !== null ? String(normalizedId) : undefined,
    _id: rawUser?._id ? String(rawUser._id) : (normalizedId !== undefined && normalizedId !== null ? String(normalizedId) : undefined),
    name: rawUser?.name || username,
    username,
    email: rawUser?.email || "",
    role: rawUser?.role === "admin" ? "admin" : "staff",
    createdAt: rawUser?.createdAt || rawUser?.created_at,
  };
};

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // If 401 and not a retry attempt, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshResponse = await apiClient.post("/auth/refresh");
        const newToken = (refreshResponse.data as any).accessToken;
        
        if (newToken) {
          setToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // For 401 without retry or other errors, clear auth
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

/* ============================
   AUTH
============================ */
const login = async (email: string, password: string) => {
  if (isElectronRuntime() || isElectronUserAgent()) {
    if (!window.electronAPI) {
      throw createAuthError("Electron bridge not loaded. Please restart the desktop app.");
    }

    const response: any =
      typeof window.electronAPI?.auth?.signin === "function"
        ? await window.electronAPI.auth.signin(email, password)
        : await invokeElectron("auth:signin", { email, password });

    if (!response?.success) {
      throw createAuthError(response?.message || "Login failed");
    }

    const token = response.accessToken || response.token || null;
    if (token) {
      setToken(token);
    }

    const user = response.user ? normalizeUser(response.user) : undefined;
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }

    return {
      ...response,
      token,
      accessToken: token,
      user,
    };
  }

  const { data } = await apiClient.post("/api/auth/login", { email, password });

  if (data.accessToken) {
    setToken(data.accessToken);
  }

  if (data.user) {
    data.user = normalizeUser(data.user);
  }

  return data;
};

const logout = () => {
  if (isElectronRuntime() || isElectronUserAgent()) {
    if (typeof window.electronAPI?.auth?.signout === "function") {
      void window.electronAPI.auth.signout();
    } else {
      void invokeElectron("auth:signout");
    }
  } else {
    void apiClient.post("/api/auth/logout").catch(() => undefined);
  }

  setToken(null);
  localStorage.removeItem("user");
};

const register = async (payload: {
  username: string;
  email: string;
  password: string;
  mobileNumber?: string;
  role?: "admin" | "staff";
}) => {
  if (isElectronRuntime() || isElectronUserAgent()) {
    if (!window.electronAPI) {
      throw createAuthError("Electron bridge not loaded. Please restart the desktop app.");
    }

    const signupPayload = {
      name: payload.username,
      email: payload.email,
      password: payload.password,
      role: payload.role || "staff",
    };

    const response: any =
      typeof window.electronAPI?.auth?.signup === "function"
        ? await window.electronAPI.auth.signup(signupPayload)
        : await invokeElectron("auth:signup", signupPayload);

    if (!response?.success) {
      return {
        error: response?.message || "Signup failed",
      };
    }

    return {
      ...response,
      token: response.token || response.accessToken,
      accessToken: response.accessToken || response.token,
      user: response.user ? normalizeUser(response.user) : undefined,
      success: true,
    };
  }

  const { data } = await apiClient.post("/api/auth/register", payload);
  return data;
};

const verifyAuthToken = async (token?: string) => {
  const activeToken = token || getToken();
  if (!activeToken) {
    return { success: false, message: "No token" };
  }

  if (isElectronRuntime() || isElectronUserAgent()) {
    if (!window.electronAPI) {
      return { success: false, message: "Electron bridge not loaded" };
    }

    const response: any =
      typeof window.electronAPI?.auth?.verify === "function"
        ? await window.electronAPI.auth.verify(activeToken)
        : await invokeElectron("auth:verify", activeToken);
    if (!response?.success || !response?.user) {
      return { success: false, message: response?.message || "Invalid token" };
    }

    return {
      success: true,
      user: normalizeUser(response.user),
    };
  }
  try {
    const { data } = await apiClient.get("/api/auth/me");
    const user = data?.user ? normalizeUser(data.user) : normalizeUser(data);
    if (!user?.email) {
      return { success: false, message: "Invalid user session" };
    }
    return { success: true, user };
  } catch {
    return { success: false, message: "Invalid or expired token" };
  }
};

const changePassword = async (payload: { userId: string; oldPassword: string; newPassword: string }) => {
  if (isElectronRuntime() || isElectronUserAgent()) {
    if (!window.electronAPI) {
      throw createAuthError("Electron bridge not loaded. Please restart the desktop app.");
    }

    if (typeof window.electronAPI?.auth?.changePassword === "function") {
      return window.electronAPI.auth.changePassword(payload);
    }
    return invokeElectron("auth:changePassword", payload);
  }

  const { data } = await apiClient.post("/api/auth/change-password", payload);
  return data;
};

const verifyEmailOtp = async (payload: { email: string; otp: string }) => {
  const { data } = await apiClient.post("/api/auth/verify-email", payload);
  return data;
};

const resendEmailOtp = async (payload: { email: string }) => {
  const { data } = await apiClient.post("/api/auth/resend-otp", payload);
  return data;
};

/* ============================
   INVENTORY
============================ */
const createInventoryItem = async (data: any) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("inventory:create", data);
      if (response?.success) {
        emitDesktopDataChanged();
      }
      return response;
    }

    const response = await apiClient.post("/api/inventory", data);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error creating inventory:", error);
    const err = error as any;
    return {
      success: false,
      data: null,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

const updateInventoryItem = async (id: string, data: any) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("inventory:update", { id, data });
      if (response?.success) {
        emitDesktopDataChanged();
      }
      return response;
    }

    const response = await apiClient.put(`/api/inventory/${id}`, data);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error updating inventory:", error);
    const err = error as any;
    return {
      success: false,
      data: null,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

export interface InventoryResponse {
  data: any[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const getInventory = async (params?: any) => {
  try {
    if (isElectronRuntime()) {
      const channel = params?.search ? "inventory:search" : "inventory:getAll";
      const [response, references] = await Promise.all([
        invokeElectron<any>(channel, params || {}),
        getDesktopReferenceMaps(),
      ]);
      const inventoryItems = Array.isArray(response?.data)
        ? response.data.map((item: any) => normalizeDesktopInventoryItem(item, references))
        : [];
      return {
        success: response?.success !== false,
        data: inventoryItems,
        meta: response?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 },
      };
    }

    const response = await apiClient.get<InventoryResponse>("/api/inventory", { params });
    return {
      success: true,
      data: Array.isArray(response.data) ? response.data : response.data?.data || [],
      meta: response.data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 }
    };
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return { success: false, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } };
  }
};

const getInventoryById = async (id: string) => {
  try {
    if (isElectronRuntime()) {
      const [response, references] = await Promise.all([
        invokeElectron<any>("inventory:getById", { id }),
        getDesktopReferenceMaps(),
      ]);
      if (!response?.success || !response?.data) {
        return response;
      }

      return {
        ...response,
        data: normalizeDesktopInventoryItem(response.data, references),
      };
    }

    const response = await apiClient.get(`/api/inventory/${id}`);
    // Handle both wrapped and unwrapped responses
    const itemData = response.data?.data || response.data;
    return { success: true, data: itemData };
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    return { success: false, data: null };
  }
};

const deleteInventoryItem = async (id: string) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("inventory:delete", { id });
      if (response?.success) {
        emitDesktopDataChanged();
      }
      return response;
    }

    const response = await apiClient.delete(`/api/inventory/${id}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error deleting inventory:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

/* ============================
   CATEGORIES
============================ */
const getCategories = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("categories:getAll", params || {});
      return {
        success: response?.success !== false,
        data: Array.isArray(response?.data)
          ? response.data.map((c: any) => ({
              id: c._id || c.id,
              _id: c._id || c.id,
              name: c.name,
              description: c.description || "",
              createdAt: c.createdAt,
              isDeleted: c.isDeleted || false,
            }))
          : [],
        meta: response?.meta || null,
      };
    }

    const res = await apiClient.get("/api/categories", { params });

    return {
      success: true,
      data: Array.isArray(res.data?.data)
        ? res.data.data.map((c: any) => ({
            id: c._id,
            _id: c._id,
            name: c.name,
            description: c.description || '',
            createdAt: c.createdAt,
            isDeleted: c.isDeleted || false,
          }))
        : [],
      meta: res.data?.meta || null,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      meta: null,
    };
  }
};

const createCategory = async (payload: any) => {
  try {
    if (isElectronRuntime()) {
      return await invokeElectron("categories:create", payload);
    }

    const response = await apiClient.post("/api/categories", payload);
    return { success: true, data: response.data };
  } catch (error: any) {
    const message =
      error?.response?.status === 409
        ? "Category already exists"
        : error?.response?.data?.message || "Failed to create category";

    return {
      success: false,
      message,
      status: error?.response?.status,
    };
  }
};

const updateCategory = async (id: string, payload: any) => {
  try {
    const response = await apiClient.put(`/api/categories/${id}`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error updating category:", error);
    return { success: false, data: null };
  }
};

const deleteCategory = async (id: string) => {
  try {
    const response = await apiClient.delete(`/api/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting category:", error);
    return { success: false, message: (error as Error).message };
  }
};

const exportCategoriesExcel = async () => {
  try {
    const response = await apiClient.get("/api/categories/export", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "categories.xlsx");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error exporting categories:", error);
    return { success: false };
  }
};

/* ============================
   SHAPES
============================ */
const getShapes = async () => {
  try {
    if (isElectronRuntime()) {
      const response: any =
        typeof window.electronAPI?.shapes?.getAll === "function"
          ? await window.electronAPI.shapes.getAll({ page: 1, limit: 1000 })
          : await invokeElectron("shapes:getAll", { page: 1, limit: 1000 });

      const shapesData = Array.isArray(response?.data) ? response.data : [];
      return {
        success: response?.success !== false,
        data: shapesData.filter((s: any) => s && s._id && s.name),
      };
    }

    const response = await apiClient.get("/api/shapes");
    const shapesData = response.data?.data || response.data || [];
    const shapesList = Array.isArray(shapesData) ? shapesData : [];

    return {
      success: true,
      data: shapesList.filter((s: any) => s && s._id && s.name)
    };
  } catch (error) {
    console.error("Error fetching shapes:", error);
    return { success: false, data: [] };
  }
};

const getMineNames = async () => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("inventory:getAll", { page: 1, limit: 100000 });
      const items = Array.isArray(response?.data) ? response.data : [];
      const unique = Array.from(
        new Set(
          items
            .map((item: any) => String(item?.mineName || "").trim())
            .filter((name: string) => name.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b));

      return {
        success: true,
        data: unique,
      };
    }

    const response = await apiClient.get("/api/inventory/mines");
    return {
      success: true,
      data: response.data?.data || []
    };
  } catch (error) {
    console.error("Error fetching mine names:", error);
    return { success: false, data: [] };
  }
};

const createShape = async (payload: any) => {
  try {
    if (isElectronRuntime()) {
      const response: any =
        typeof window.electronAPI?.shapes?.create === "function"
          ? await window.electronAPI.shapes.create(payload)
          : await invokeElectron("shapes:create", payload);

      return {
        success: response?.success !== false,
        data: response?.data || null,
        message: response?.message,
      };
    }

    const response = await apiClient.post("/api/shapes", payload);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error creating shape:", error);
    const err = error as any;
    return {
      success: false,
      data: null,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

const getInventoryShapes = async () => {
  try {
    const response = await getShapes();
    if (response.success && Array.isArray(response.data)) {
      return {
        success: true,
        data: response.data
          .filter((shape: any) => shape && shape.name)
          .map((shape: any) => shape.name || ''),
      };
    }
    return { success: true, data: [] };
  } catch (error) {
    console.error("Error fetching inventory shapes:", error);
    return { success: false, data: [] };
  }
};

/* ============================
   SERIES
============================ */
const getSeries = async (params?: { search?: string; page?: number; limit?: number }) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("series:getAll", params || {});
      return {
        success: response?.success !== false,
        data: Array.isArray(response?.data) ? response.data : [],
        meta: response?.meta || null,
      };
    }

    const response = await apiClient.get("/api/series", { params });
    return {
      success: true,
      data: Array.isArray(response.data?.data) ? response.data.data : [],
      meta: response.data?.meta || null
    };
  } catch (error) {
    console.error("Error fetching series:", error);
    return { success: false, data: [], meta: null };
  }
};

const createSeriesItem = async (payload: { name: string }) => {
  try {
    if (isElectronRuntime()) {
      return await invokeElectron("series:create", payload);
    }

    const response = await apiClient.post("/api/series", payload);
    return { success: true, data: response.data?.data || response.data };
  } catch (error: any) {
    console.error("Error creating series:", error);
    return {
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to create series"
    };
  }
};

const updateSeriesItem = async (id: string, payload: { name: string }) => {
  try {
    const response = await apiClient.put(`/api/series/${id}`, payload);
    return { success: true, data: response.data?.data || response.data };
  } catch (error: any) {
    console.error("Error updating series:", error);
    return {
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to update series"
    };
  }
};

const deleteSeriesItem = async (id: string) => {
  try {
    await apiClient.delete(`/api/series/${id}`);
    return { success: true, message: "Series deleted successfully" };
  } catch (error: any) {
    console.error("Error deleting series:", error);
    return {
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to delete series"
    };
  }
};

/* ============================
   MERGE PACKETS
============================ */
const getMergeCandidates = async (sourceId: string) => {
  try {
    const response = await apiClient.get(`/api/inventory/merge-candidates/${sourceId}`);
    return { success: true, data: response.data?.data || [] };
  } catch (error) {
    console.error("Error fetching merge candidates:", error);
    return { success: false, data: [] };
  }
};

const mergePackets = async (sourceId: string, targetId: string) => {
  try {
    const response = await apiClient.post("/api/inventory/merge", { sourceId, targetId });
    return { success: true, data: response.data?.data, message: response.data?.message };
  } catch (error: any) {
    console.error("Error merging packets:", error);
    return {
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to merge packets"
    };
  }
};

/* ============================
   UPLOADS
============================ */
const uploadImage = async (file: File) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("images:save", {
        fileName: file.name,
        mimeType: file.type,
        folder: "inventory",
        bytes: await fileToBytes(file),
      });

      return {
        data: {
          url: response?.data?.url || response?.data?.path || "",
          publicId: response?.data?.path,
        },
      };
    }

    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post("/api/inventory-upload/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { 
      data: { 
        url: response.data?.url || response.data,
        publicId: response.data?.publicId
      } 
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { data: null, error: (error as Error).message };
  }
};

/* ============================
   SALES
============================ */
const sellInventory = async (data: any) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("sold:create", data);
      if (response?.success) {
        emitDesktopDataChanged();
      }
      return response;
    }

    const response = await apiClient.post("/api/sales", data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error selling inventory:", error);
    return { success: false, error: (error as Error).message };
  }
};

const getSoldItems = async (params?: any) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("sold:getAll", params || {});
      return {
        success: response?.success !== false,
        data: Array.isArray(response?.data)
          ? response.data.map((sale: any) => normalizeDesktopSaleItem(sale))
          : [],
        meta: response?.meta || null,
      };
    }

    const response = await apiClient.get("/api/sales", { params });
    return { success: true, data: Array.isArray(response.data) ? response.data : response.data?.data || [] };
  } catch (error) {
    console.error("Error fetching sold items:", error);
    return { success: false, data: [] };
  }
};

const undoSale = async (saleId: string) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("sold:undo", { id: saleId });
      if (response?.success) {
        emitDesktopDataChanged();
      }
      return response;
    }

    const response = await apiClient.post(`/api/sales/${saleId}/undo`);
    return { success: true, data: response.data, message: response.data?.message };
  } catch (error: unknown) {
    console.error("Error undoing sale:", error);
    const err = error as any;
    return { success: false, message: err?.response?.data?.message || err.message };
  }
};

// Alias for getSoldItems - used by SoldItems page
const getSales = async (params?: any) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("sold:getAll", params || {});
      return {
        success: response?.success !== false,
        data: Array.isArray(response?.data)
          ? response.data.map((sale: any) => normalizeDesktopSaleItem(sale))
          : [],
        meta: response?.meta || null,
      };
    }

    const response = await apiClient.get("/api/sales", { params });
    return {
      success: true,
      data: Array.isArray(response.data) ? response.data : response.data?.data || [],
      meta: response.data?.meta || null,
    };
  } catch (error) {
    console.error("Error fetching sales:", error);
    return { success: false, data: [], meta: null };
  }
};

// Get inventory items available for sale (in_stock or partially_sold)
const getInventoryForSale = async () => {
  try {
    if (isElectronRuntime()) {
      const [response, references] = await Promise.all([
        invokeElectron<any>("inventory:getAll", { limit: 500 }),
        getDesktopReferenceMaps(),
      ]);
      const items = Array.isArray(response?.data)
        ? response.data.map((item: any) => normalizeDesktopInventoryItem(item, references))
        : [];
      return {
        success: true,
        data: items.filter((item: any) =>
          ["in_stock", "partially_sold"].includes(item?.status)
        ),
      };
    }

    const response = await apiClient.get("/api/inventory", {
      params: { status: "in_stock,partially_sold", limit: 500 },
    });
    const items = Array.isArray(response.data) ? response.data : response.data?.data || [];
    return { success: true, data: items };
  } catch (error) {
    console.error("Error fetching inventory for sale:", error);
    return { success: false, data: [], message: "Failed to fetch inventory" };
  }
};

// Sell inventory item (shape-based selling)
const sellInventoryItem = async (data: {
  inventoryId: string;
  soldShapes: Array<{
    shape?: string;
    shapeName?: string;
    pieces: number;
    weight: number;
    pricePerCarat: number;
    lineTotal: number;
  }>;
  customer?: { name?: string; email?: string; phone?: string };
  invoiceNumber?: string;
}) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("sold:create", data);
      if (response?.success) {
        emitDesktopDataChanged();
      }
      return response;
    }

    // Normalize shape field names
    const normalizedShapes = data.soldShapes.map((s) => ({
      shape: s.shape || s.shapeName || "General",
      pieces: s.pieces,
      weight: s.weight,
      pricePerCarat: s.pricePerCarat,
      lineTotal: s.lineTotal,
    }));

    const response = await apiClient.post("/api/sales/sell", {
      inventoryId: data.inventoryId,
      soldShapes: normalizedShapes,
      customer: data.customer || {},
      invoiceNumber: data.invoiceNumber || "",
    });
    return { success: true, data: response.data?.data || response.data, message: response.data?.message };
  } catch (error: unknown) {
    console.error("Error selling inventory:", error);
    const err = error as any;
    return {
      success: false,
      data: null,
      message: err?.response?.data?.message || err.message,
    };
  }
};

// Export sales as Excel
const exportSoldItemsExcel = async () => {
  try {
    const response = await apiClient.get("/api/sales/export/excel", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sales.xlsx");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error exporting sales:", error);
    return { success: false };
  }
};

/* ============================
   USERS
============================ */
const getUsers = async (params?: any) => {
  try {
    if (isElectronRuntime()) {
      const response: any = await invokeElectron("users:getAll", params || {});
      if (!response?.success) {
        return { success: false, data: [], message: response?.message || "Failed to fetch users" };
      }

      return {
        success: true,
        data: Array.isArray(response.data) ? response.data.map((user: any) => normalizeUser(user)) : [],
      };
    }

    const response = await apiClient.get("/api/users", { params });
    const rawUsers = Array.isArray(response.data) ? response.data : response.data?.data || [];
    return { success: true, data: rawUsers.map((user: any) => normalizeUser(user)) };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, data: [] };
  }
};

const createUser = async (payload: any) => {
  try {
    if (isElectronRuntime()) {
      const response: any = await invokeElectron("users:create", {
        name: payload.username || payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role || "staff",
      });

      if (!response?.success) {
        return {
          success: false,
          message: response?.message || "Failed to create user",
        };
      }

      return { success: true, data: normalizeUser(response.data) };
    }

    const response = await apiClient.post("/api/users", payload);
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { 
      success: false, 
      message: error?.response?.data?.message || error.message || "Failed to create user"
    };
  }
};

const updateUser = async (id: string, payload: any) => {
  try {
    if (isElectronRuntime()) {
      const roleOnlyUpdate =
        payload?.role &&
        !payload?.username &&
        !payload?.name &&
        !payload?.email &&
        !payload?.password;

      const response: any = roleOnlyUpdate
        ? await invokeElectron("users:updateRole", { id, role: payload.role })
        : await invokeElectron("users:update", {
            id,
            data: {
              name: payload.username || payload.name,
              email: payload.email,
              password: payload.password,
              role: payload.role,
            },
          });

      if (!response?.success) {
        return {
          success: false,
          message: response?.message || "Failed to update user",
        };
      }

      return { success: true, data: normalizeUser(response.data) };
    }

    const response = await apiClient.put(`/api/users/${id}`, payload);
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error updating user:", error);
    return { 
      success: false, 
      message: error?.response?.data?.message || error.message || "Failed to update user"
    };
  }
};

const deleteUser = async (id: string) => {
  try {
    if (isElectronRuntime()) {
      const response: any = await invokeElectron("users:delete", { id });
      if (!response?.success) {
        return {
          success: false,
          message: response?.message || "Failed to delete user",
        };
      }

      return { success: true, message: "User deleted successfully" };
    }

    await apiClient.delete(`/api/users/${id}`);
    return { success: true, message: "User deleted successfully" };
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return { 
      success: false, 
      message: error?.response?.data?.message || error.message || "Failed to delete user"
    };
  }
};

const exportUsersExcel = async () => {
  try {
    const response = await apiClient.get("/api/users/export/excel", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "users.xlsx");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error exporting users:", error);
    return { success: false };
  }
};

/* ============================
   DASHBOARD
============================ */
const getDashboardStats = async () => {
  const emptyStats: DashboardStats = {
    totalInventory: 0,
    in_stockItems: 0,
    partiallySoldItems: 0,
    soldItems: 0,
    pendingApproval: 0,
    totalValue: 0,
    totalWeight: 0,
    totalPieces: 0,
    totalSalesAmount: 0,
    inStockValue: 0,
    recentSales: [],
  };

  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("dashboard:getStats");

      if (response?.success === false) {
        return {
          success: false,
          error: response?.message || "Failed to fetch dashboard stats",
          data: emptyStats,
        };
      }

      return {
        success: true,
        data: response?.data || emptyStats,
      };
    }

    const response = await apiClient.get("/api/dashboard");
    const data = response.data?.data || response.data || emptyStats;
    return {
      success: true,
      data: {
        ...emptyStats,
        ...data,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      success: false,
      error: (error as Error)?.message || "Failed to fetch dashboard stats",
      data: emptyStats,
    };
  }
};

/* ============================
   COMPANY / SETTINGS
============================ */
const getCompany = async () => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("company:get");
      return response?.data || null;
    }

    const response = await apiClient.get("/api/company");
    return response.data;
  } catch (error) {
    console.error("Error fetching company:", error);
    return null;
  }
};

const saveCompany = async (payload: any) => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("company:save", payload);
      return response?.success === true;
    }

    await apiClient.post("/api/company", payload);
    return true;
  } catch (error) {
    console.error("Error saving company:", error);
    return false;
  }
};

const uploadCompanyImage = async (file: File, type: "logo" | "signature") => {
  try {
    if (isElectronRuntime()) {
      const response = await invokeElectron<any>("images:save", {
        fileName: file.name,
        mimeType: file.type,
        folder: "company",
        bytes: await fileToBytes(file),
      });
      return response?.data?.url || response?.data?.path || "";
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("type", type);
    const response = await apiClient.post("/api/company/upload", formData);
    return response.data?.url || "";
  } catch (error) {
    console.error("Error uploading company image:", error);
    return "";
  }
};

const backupData = async () => {
  try {
    if (!isElectronRuntime()) {
      return { success: false, message: "Backup is available only in desktop mode" };
    }

    return await window.electronAPI!.backupData();
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to backup data",
    };
  }
};

const restoreData = async () => {
  try {
    if (!isElectronRuntime()) {
      return { success: false, message: "Restore is available only in desktop mode" };
    }

    return await window.electronAPI!.restoreData();
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to restore data",
    };
  }
};

/* ============================
   RECYCLE BIN
============================ */
const restoreRecycleBinItems = async (ids: string[]) => {
  try {
    const response = await apiClient.post("/api/recycle-bin/restore", { ids });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error restoring recycle bin items:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

const deleteRecycleBinItems = async (ids: string[]) => {
  try {
    const response = await apiClient.delete("/api/recycle-bin/delete", { data: { ids } });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error permanently deleting recycle bin items:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

const emptyRecycleBin = async () => {
  try {
    const response = await apiClient.post("/api/recycle-bin/empty");
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error emptying recycle bin:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

const getRecycleBinItems = async (params?: any) => {
  try {
    const response = await apiClient.get("/api/recycle-bin", { params });
    return { success: true, data: Array.isArray(response.data) ? response.data : response.data?.data || [], meta: response.data?.meta || { pages: 1 } };
  } catch (error: unknown) {
    console.error("Error fetching recycle bin:", error);
    const err = error as any;
    return {
      success: false,
      data: [],
      meta: { pages: 1 },
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

const restoreFromRecycleBin = async (id: string) => {
  try {
    const response = await apiClient.post(`/api/recycle-bin/${id}/restore`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error restoring from recycle bin:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
      status: err?.response?.status
    };
  }
};

/* ============================
   ANALYTICS
============================ */
const getAnalytics = async (params?: any) => {
  try {
    if (isElectronRuntime()) {
      return {
        success: true,
        data: await buildDesktopAnalytics(),
      };
    }

    const response = await apiClient.get("/api/analytics", { params });
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return { success: false, data: buildEmptyAnalytics() };
  }
};

const getProfitAnalytics = async () => {
  try {
    if (isElectronRuntime()) {
      return await buildDesktopAnalytics();
    }

    const response = await apiClient.get("/api/analytics");
    return response.data;
  } catch (error) {
    console.error("Error fetching profit analytics:", error);
    return { totals: { revenue: 0, cost: 0, profit: 0 }, monthly: [], categories: [] };
  }
};

const exportProfitExcel = async () => {
  try {
    if (isElectronRuntime()) {
      const analytics = await buildDesktopAnalytics();
      const workbook = XLSX.utils.book_new();

      const summaryRows = [
        { Metric: "Total Revenue", Value: analytics.totals.revenue },
        { Metric: "Total Weight", Value: analytics.totals.totalWeight },
        { Metric: "Total Pieces", Value: analytics.totals.totalPieces },
        { Metric: "Total Sales", Value: analytics.totals.count },
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(analytics.monthly.length ? analytics.monthly : [{ month: "No Data", revenue: 0, count: 0, weight: 0 }]),
        "Monthly"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(analytics.categories.length ? analytics.categories : [{ _id: "No Data", revenue: 0, count: 0, weight: 0 }]),
        "Categories"
      );

      const bytes = Array.from(new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer));
      return saveBytesToDesktop({
        title: "Save Profit Report",
        defaultFileName: `profit-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
        bytes,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
    }

    const response = await apiClient.get("/api/analytics/export/excel", {
      responseType: "blob",
    });
    downloadBlobInBrowser(new Blob([response.data]), "profit-report.xlsx");
    return { success: true };
  } catch (error) {
    console.error("Error exporting profit report:", error);
    return { success: false, message: "Failed to export profit report" };
  }
};

/* ============================
   INVOICES
============================ */
const getInvoiceBySold = async (soldId: string) => {
  try {
    const response = await apiClient.get(`/api/invoices/sold/${soldId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return null;
  }
};

const getInvoiceById = async (id: string) => {
  try {
    const response = await apiClient.get(`/api/invoices/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return null;
  }
};

const createBulkInvoice = async (saleIds: string[]) => {
  try {
    const response = await apiClient.post("/api/invoices/bulk-create", { saleIds });
    return response.data;
  } catch (error: unknown) {
    console.error("Error creating bulk invoice:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message || "Failed to create invoice",
    };
  }
};

const downloadInvoicePDF = async (invoiceId: string) => {
  try {
    const response = await apiClient.get(`/api/invoices/${invoiceId}/pdf`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `invoice-${invoiceId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error downloading invoice PDF:", error);
    return { success: false };
  }
};

/* ============================
   EXPORT INVENTORY
============================ */
const exportInventoryExcel = async (params?: Record<string, any>) => {
  if (isElectronRuntime()) {
    const items = await getDesktopInventoryForExport(params || {});
    const rows = items.map((item: any) => {
      const purchasePrice = toFiniteNumber(
        getFirstDefined(item?.purchasePrice, item?.purchase_price),
        Number.NaN
      );
      const salePrice = toFiniteNumber(
        getFirstDefined(item?.salePrice, item?.sale_price),
        Number.NaN
      );

      return {
        "Serial Number": item.serialNumber || "",
        "Category": getCategoryName(item) || "",
        "Cutting Style": item.cuttingStyle || "",
        "Series": getSeriesName(item) || "",
        "Shape Type": item.shapeType || "",
        "Shapes": getShapeNames(item).join(", "),
        "Total Pieces": Number(item.totalPieces || 0),
        "Available Pieces": Number(item.availablePieces || 0),
        "Total Weight (ct)": Number(item.totalWeight || 0),
        "Available Weight (ct)": Number(item.availableWeight || 0),
        "Lines": item.lines || "",
        "Gross Weight": item.grossWeight || "",
        "Dim Min": formatDimensions(item.dimensions?.min),
        "Dim Max": formatDimensions(item.dimensions?.max),
        "Purchase Price": Number.isFinite(purchasePrice) ? Number(purchasePrice.toFixed(2)) : "",
        "Sale Price": Number.isFinite(salePrice) ? Number(salePrice.toFixed(2)) : "",
        "Purchase Code": item.purchaseCode || "",
        "Sale Code": item.saleCode || "",
        "Certification": item.certification || "",
        "Location": item.location || "",
        "Mine/Source": item.mineName || "",
        "Status": item.status || "in_stock",
        "Description": item.description || "",
        "Created At": item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "",
      };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No items matched current filters" }]),
      "Inventory"
    );

    const bytes = Array.from(new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer));
    return saveBytesToDesktop({
      title: "Save Inventory Excel",
      defaultFileName: `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`,
      bytes,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
  }

  const res = await apiClient.get('/api/inventory/export/excel', {
    responseType: 'blob',
    params,
  });

  downloadBlobInBrowser(new Blob([res.data]), "inventory.xlsx");

  return { success: true };
};

const importInventoryCSV = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post("/api/inventory/import/csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error importing CSV:", error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || err.message,
      data: null,
    };
  }
};

const downloadCSVTemplate = async () => {
  try {
    const response = await apiClient.get("/api/inventory/template/csv", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inventory-template.csv");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error downloading CSV template:", error);
    return { success: false };
  }
};

const getItemQRUrl = (itemId: string) => {
  return `${BASE_URL}/api/inventory/qr/${itemId}`;
};

const downloadQRLabelsPDF = async (params?: Record<string, any>) => {
  try {
    if (isElectronRuntime()) {
      const items = await getDesktopInventoryForExport(params || {});

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: "letter",
      });

      const LABEL_W = 3.5;
      const LABEL_H = 1.5;
      const COLS = 2;
      const ROWS = 3;
      const MARGIN_X = 0.5;
      const MARGIN_Y = 0.6;
      const GAP_X = 0.5;
      const GAP_Y = 0.2;
      const labelsPerPage = COLS * ROWS;

      const drawPrintNote = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text("Print at 100% scale - do not fit to page", MARGIN_X, 0.35);
      };

      drawPrintNote();

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];

        if (index > 0 && index % labelsPerPage === 0) {
          doc.addPage();
          drawPrintNote();
        }

        const positionOnPage = index % labelsPerPage;
        const col = positionOnPage % COLS;
        const row = Math.floor(positionOnPage / COLS);
        const x = MARGIN_X + col * (LABEL_W + GAP_X);
        const y = MARGIN_Y + row * (LABEL_H + GAP_Y);

        const qrValue = String(item?.serialNumber || item?._id || item?.id || `item-${index + 1}`);
        const qrDataUrl = await QRCode.toDataURL(qrValue, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
        });

        const category = String(getCategoryName(item) || "-").toUpperCase();
        const shapeNames = getShapeNames(item);
        const shapeRaw = shapeNames.length > 0 ? shapeNames.join(" / ") : String(item?.shapeType || "-");
        const shapeLine = shapeRaw.length > 28 ? `${shapeRaw.slice(0, 28)}...` : shapeRaw;

        const availableWeight = toFiniteNumber(
          getFirstDefined(item?.availableWeight, item?.available_weight),
          0
        );
        const totalWeight = toFiniteNumber(
          getFirstDefined(item?.totalWeight, item?.total_weight),
          0
        );
        const availablePieces = toFiniteInteger(
          getFirstDefined(item?.availablePieces, item?.available_pieces),
          0
        );
        const totalPieces = toFiniteInteger(
          getFirstDefined(item?.totalPieces, item?.total_pieces),
          0
        );

        const dimMin = formatDimensions(item?.dimensions?.min);
        const dimMax = formatDimensions(item?.dimensions?.max);
        const dimLine = dimMin === "N/A" && dimMax === "N/A"
          ? "Dim: N/A"
          : `Dim: ${dimMin}${dimMax !== "N/A" ? ` - ${dimMax}` : ""}`;

        const buyCode = String(item?.purchaseCode || "-").trim() || "-";
        const sellCode = String(item?.saleCode || "-").trim() || "-";
        const series = String(getSeriesName(item) || "-").trim() || "-";

        doc.setDrawColor(200);
        doc.setLineWidth(0.01);
        doc.rect(x, y, LABEL_W, LABEL_H);

        const qrSize = 1.1;
        const qrPad = 0.12;
        doc.addImage(
          qrDataUrl,
          "PNG",
          x + qrPad,
          y + (LABEL_H - qrSize) / 2,
          qrSize,
          qrSize
        );

        const textX = x + qrPad + qrSize + 0.12;
        const maxTextWidth = LABEL_W - (textX - x) - 0.1;
        let textY = y + 0.18;
        const lineHeight = 0.16;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(0);
        doc.text(qrValue, textX, textY, { maxWidth: maxTextWidth });
        textY += lineHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(40);
        doc.text(category, textX, textY, { maxWidth: maxTextWidth });
        textY += lineHeight;

        doc.text(shapeLine || "-", textX, textY, { maxWidth: maxTextWidth });
        textY += lineHeight;

        doc.text(`Wt: ${availableWeight.toFixed(2)}/${totalWeight.toFixed(2)} ct`, textX, textY);
        textY += lineHeight;

        doc.text(`Pcs: ${availablePieces}/${totalPieces}`, textX, textY);
        textY += lineHeight;

        doc.text(dimLine, textX, textY, { maxWidth: maxTextWidth });
        textY += lineHeight;

        doc.text(`Buy: ${buyCode}  Sell: ${sellCode}`, textX, textY, { maxWidth: maxTextWidth });
        textY += lineHeight;

        doc.setTextColor(100);
        doc.setFontSize(6);
        doc.text(series, textX, textY, { maxWidth: maxTextWidth });
      }

      const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
      return saveBytesToDesktop({
        title: "Save QR Labels PDF",
        defaultFileName: `qr-labels-${new Date().toISOString().slice(0, 10)}.pdf`,
        bytes,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    }

    const response = await apiClient.get("/api/inventory/qr/labels", {
      params,
      responseType: "blob",
    });
    downloadBlobInBrowser(new Blob([response.data], { type: 'application/pdf' }), "qr-labels.pdf");
    return { success: true };
  } catch (error) {
    console.error("Error downloading QR labels:", error);
    return { success: false, message: "Failed to download QR labels" };
  }
};

const exportInventoryExcelWithQR = async (params?: Record<string, any>) => {
  try {
    if (isElectronRuntime()) {
      const items = await getDesktopInventoryForExport(params || {});

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Inventory QR");

      sheet.columns = [
        { header: "Serial Number", key: "serialNumber", width: 15 },
        { header: "Category", key: "category", width: 14 },
        { header: "Cutting Style", key: "cuttingStyle", width: 16 },
        { header: "Series", key: "series", width: 12 },
        { header: "Shape Type", key: "shapeType", width: 12 },
        { header: "Shapes", key: "shapes", width: 24 },
        { header: "Total Pieces", key: "totalPieces", width: 13 },
        { header: "Available Pieces", key: "availablePieces", width: 16 },
        { header: "Total Weight (ct)", key: "totalWeight", width: 16 },
        { header: "Available Weight", key: "availableWeight", width: 17 },
        { header: "Lines", key: "lines", width: 8 },
        { header: "Gross Weight", key: "grossWeight", width: 13 },
        { header: "Dim Min", key: "dimMin", width: 12 },
        { header: "Dim Max", key: "dimMax", width: 12 },
        { header: "Purchase Price", key: "purchasePrice", width: 15 },
        { header: "Sale Price", key: "salePrice", width: 12 },
        { header: "Purchase Code", key: "purchaseCode", width: 15 },
        { header: "Sale Code", key: "saleCode", width: 12 },
        { header: "Mine", key: "mine", width: 12 },
        { header: "Description", key: "description", width: 22 },
        { header: "Status", key: "status", width: 14 },
        { header: "Created At", key: "createdAt", width: 18 },
        { header: "QR Code", key: "qr", width: 14 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1A1A2E" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 20;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const serial = String(item?.serialNumber || item?._id || item?.id || "");
        const purchasePrice = toFiniteNumber(
          getFirstDefined(item?.purchasePrice, item?.purchase_price),
          Number.NaN
        );
        const salePrice = toFiniteNumber(
          getFirstDefined(item?.salePrice, item?.sale_price),
          Number.NaN
        );
        const rowIndex = index + 2;

        sheet.addRow({
          serialNumber: serial,
          category: getCategoryName(item) || "",
          cuttingStyle: item?.cuttingStyle || "",
          series: getSeriesName(item) || "",
          shapeType: item?.shapeType || "",
          shapes: getShapeNames(item).join(", "),
          totalPieces: Number(item?.totalPieces || 0),
          availablePieces: Number(item?.availablePieces || 0),
          totalWeight: Number(toFiniteNumber(item?.totalWeight, 0).toFixed(2)),
          availableWeight: Number(toFiniteNumber(item?.availableWeight, 0).toFixed(2)),
          lines: item?.lines || "",
          grossWeight: item?.grossWeight || "",
          dimMin: formatDimensions(item?.dimensions?.min),
          dimMax: formatDimensions(item?.dimensions?.max),
          purchasePrice: Number.isFinite(purchasePrice) ? Number(purchasePrice.toFixed(2)) : "",
          salePrice: Number.isFinite(salePrice) ? Number(salePrice.toFixed(2)) : "",
          purchaseCode: item?.purchaseCode || "",
          saleCode: item?.saleCode || "",
          mine: item?.mineName || "",
          description: item?.description || "",
          status: item?.status || "in_stock",
          createdAt: item?.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB") : "",
        });

        sheet.getRow(rowIndex).height = 46;

        if (serial) {
          const qrDataUrl = await QRCode.toDataURL(serial, {
            width: 120,
            margin: 1,
            errorCorrectionLevel: "M",
          });
          const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
          const imageId = workbook.addImage({
            base64,
            extension: "png",
          });

          sheet.addImage(imageId, {
            tl: { col: 22.15, row: rowIndex - 1 + 0.08 },
            ext: { width: 56, height: 56 },
          });
        }
      }

      if (items.length === 0) {
        sheet.addRow({ serialNumber: "No items matched current filters" });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const bytes = Array.from(new Uint8Array(buffer as ArrayBuffer));
      return saveBytesToDesktop({
        title: "Save Inventory Excel + QR",
        defaultFileName: `inventory-with-qr-${new Date().toISOString().slice(0, 10)}.xlsx`,
        bytes,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
    }

    const response = await apiClient.get('/api/inventory/export/excel-qr', {
      responseType: 'blob',
      params,
    });
    downloadBlobInBrowser(new Blob([response.data]), "inventory_with_qr.xlsx");
    return { success: true };
  } catch (error) {
    console.error('Error exporting Excel with QR:', error);
    return { success: false, message: "Failed to export Excel with QR" };
  }
};

const displayItemQR = async (itemId: string) => {
  try {
    const response = await apiClient.get(`/api/inventory/qr/display/${itemId}`);
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching item QR display:', error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || 'Failed to fetch QR display'
    };
  }
};

const downloadSeriesQRLabelPDF = async (seriesId: string) => {
  try {
    const response = await apiClient.get(`/api/inventory/series/${seriesId}/qr-label`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `series-${seriesId}-qr-label.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    console.error('Error downloading series QR label:', error);
    return { success: false };
  }
};

const getSeriesForTally = async (seriesId: string) => {
  try {
    const response = await apiClient.get(`/api/inventory/series/${seriesId}/tally-data`);
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching series for tally:', error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || 'Failed to fetch series'
    };
  }
};

const processTallyScan = async (seriesId: string, scannedItems: Array<{ id: string; sn?: string }>) => {
  try {
    const response = await apiClient.post(`/api/inventory/series/${seriesId}/tally-scan`, {
      scannedItems
    });
    return response.data;
  } catch (error: unknown) {
    console.error('Error processing tally scan:', error);
    const err = error as any;
    return {
      success: false,
      message: err?.response?.data?.message || 'Failed to process tally scan'
    };
  }
};

/* ============================
   AUDIT LOGS
============================ */
const getAuditLogs = async (params?: any) => {
  try {
    const response = await apiClient.get("/api/audit-logs", { params });
    return { 
      success: true, 
      data: Array.isArray(response.data) ? response.data : response.data?.data || [],
      meta: response.data?.meta || null
    };
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return { success: false, data: [], meta: null };
  }
};

const clearAuditLogs = async () => {
  try {
    const response = await apiClient.delete("/api/audit-logs/clear");
    const message = response?.data?.message || "Audit logs cleared successfully";
    return { success: true, message };
  } catch (error: any) {
    const errorMessage = 
      error?.response?.data?.message || 
      error?.message || 
      "Failed to clear audit logs";
    console.error("Error clearing audit logs:", { 
      error, 
      message: errorMessage,
      response: error?.response?.data 
    });
    return { 
      success: false, 
      message: errorMessage
    };
  }
};

const exportAuditLogsExcel = async () => {
  try {
    const response = await apiClient.get("/api/audit-logs/export/excel", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "audit-logs.xlsx");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return { success: false };
  }
};

/* ============================
   PACKAGING
============================ */
const getPackaging = async () => {
  try {
    const response = await apiClient.get("/api/packaging");
    return Array.isArray(response.data) ? response.data : response.data?.data || [];
  } catch (error) {
    console.error("Error fetching packaging:", error);
    return [];
  }
};

const getPackagingById = async (id: string) => {
  try {
    const response = await apiClient.get(`/api/packaging/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching packaging details:", error);
    return null;
  }
};

const createPackaging = async (data: any) => {
  try {
    const response = await apiClient.post("/api/packaging", data);
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error creating packaging:", error);
    return { 
      success: false, 
      message: error?.response?.data?.message || error.message || "Failed to create packaging" 
    };
  }
};

const generateInvoice = async (data: any) => {
  try {
    const response = await apiClient.post("/api/invoices/generate", data);
    return response.data;
  } catch (error) {
    console.error("Error generating invoice:", error);
    throw error;
  }
};

/* ============================
   EXPORT DEFAULT API
============================ */
const api = {
  // Auth
  getToken,
  setToken,
  login,
  logout,
  register,
  verifyAuthToken,
  changePassword,
  verifyEmailOtp,
  resendEmailOtp,

  // Inventory
  createInventoryItem,
  updateInventoryItem,
  getInventory,
  getInventoryById,
  deleteInventoryItem,
  exportInventoryExcel,
  importInventoryCSV,
  downloadCSVTemplate,
  getItemQRUrl,
  downloadQRLabelsPDF,
  exportInventoryExcelWithQR,
  displayItemQR,
  downloadSeriesQRLabelPDF,
  getSeriesForTally,
  processTallyScan,

  // Categories & Shapes
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  exportCategoriesExcel,
  getShapes,
  createShape,
  getInventoryShapes,
  getMineNames,

  // Series
  getSeries,
  createSeriesItem,
  updateSeriesItem,
  deleteSeriesItem,

  // Merge
  getMergeCandidates,
  mergePackets,

  // Uploads
  uploadImage,

  // Sales
  sellInventory,
  getSoldItems,
  undoSale,
  getSales,
  getInventoryForSale,
  sellInventoryItem,
  exportSoldItemsExcel,

  // Users
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  exportUsersExcel,

  // Dashboard
  getDashboardStats,

  // Company
  getCompany,
  saveCompany,
  uploadCompanyImage,
  backupData,
  restoreData,

  // Recycle Bin
  emptyRecycleBin,
  getRecycleBinItems,
  restoreFromRecycleBin,
  restoreRecycleBinItems,
  deleteRecycleBinItems,

  // Analytics
  getAnalytics,
  getProfitAnalytics,
  exportProfitExcel,

  // Invoices
  getInvoiceBySold,
  getInvoiceById,
  createBulkInvoice,
  downloadInvoicePDF,
  generateInvoice,

  // Packaging
  getPackaging,
  getPackagingById,
  createPackaging,

  // Audit Logs
  getAuditLogs,
  clearAuditLogs,
  exportAuditLogsExcel,
};

// Named exports for backward compatibility
export { getCompany, saveCompany, uploadCompanyImage, BASE_URL };

export default api;
