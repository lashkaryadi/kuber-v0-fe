import axios, { AxiosError } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ;

/* ============================
   TYPES
============================ */
export interface User {
  _id?: string;
  id?: string;
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
  lines?: number | null;
  grossWeight?: number | null;
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
  lines?: number | null;
  grossWeight?: number | null;
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
  partiallySoldItems?: number;
  totalValue: number;
  inStockValue: number | string;
  totalWeight?: number;
  totalPieces?: number;
  totalSalesAmount?: number;
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
  const { data } = await apiClient.post("/api/auth/login", { email, password });

  if (data.accessToken) {
    setToken(data.accessToken);
  }

  return data;
};

const logout = () => {
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
  const { data } = await apiClient.post("/api/auth/register", payload);
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
    const response = await apiClient.post("/api/sales", data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error selling inventory:", error);
    return { success: false, error: (error as Error).message };
  }
};

const getSoldItems = async (params?: any) => {
  try {
    const response = await apiClient.get("/api/sales", { params });
    return { success: true, data: Array.isArray(response.data) ? response.data : response.data?.data || [] };
  } catch (error) {
    console.error("Error fetching sold items:", error);
    return { success: false, data: [] };
  }
};

const undoSale = async (saleId: string) => {
  try {
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
  lines?: number | null;
  grossWeight?: number | null;
}) => {
  try {
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
      lines: data.lines,
      grossWeight: data.grossWeight,
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
    const response = await apiClient.get("/api/users", { params });
    return { success: true, data: Array.isArray(response.data) ? response.data : response.data?.data || [] };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, data: [] };
  }
};

const createUser = async (payload: any) => {
  try {
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
  try {
    const response = await apiClient.get("/api/dashboard");
    return {
      success: true,
      data: response.data?.data || response.data || {
        totalInventory: 0,
        inStockItems: 0,
        soldItems: 0,
        pendingApproval: 0,
        totalValue: 0,
        inStockValue: 0,
        recentSales: [],
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      success: false,
      data: {
        totalInventory: 0,
        inStockItems: 0,
        soldItems: 0,
        pendingApproval: 0,
        totalValue: 0,
        inStockValue: 0,
        recentSales: [],
      },
    };
  }
};

/* ============================
   COMPANY / SETTINGS
============================ */
const getCompany = async () => {
  try {
    const response = await apiClient.get("/api/company");
    return response.data;
  } catch (error) {
    console.error("Error fetching company:", error);
    return null;
  }
};

const saveCompany = async (payload: any) => {
  try {
    await apiClient.post("/api/company", payload);
    return true;
  } catch (error) {
    console.error("Error saving company:", error);
    return false;
  }
};

const uploadCompanyImage = async (file: File, type: "logo" | "signature") => {
  try {
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
    const response = await apiClient.get("/api/analytics", { params });
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return { success: false, data: {} };
  }
};

const getProfitAnalytics = async () => {
  try {
    const response = await apiClient.get("/api/analytics");
    return response.data;
  } catch (error) {
    console.error("Error fetching profit analytics:", error);
    return { totals: { revenue: 0, cost: 0, profit: 0 }, monthly: [], categories: [] };
  }
};

const exportProfitExcel = async () => {
  try {
    const response = await apiClient.get("/api/analytics/export/excel", {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "profit-report.xlsx");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error("Error exporting profit report:", error);
    return { success: false };
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
  const res = await apiClient.get('/api/inventory/export/excel', {
    responseType: 'blob',
    params,
  });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'inventory.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();

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
    const response = await apiClient.get("/api/inventory/qr/labels", {
      params,
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "qr-labels.pdf");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    console.error("Error downloading QR labels:", error);
    return { success: false };
  }
};

const exportInventoryExcelWithQR = async (params?: Record<string, any>) => {
  try {
    const response = await apiClient.get('/api/inventory/export/excel-qr', {
      responseType: 'blob',
      params,
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_with_qr.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    console.error('Error exporting Excel with QR:', error);
    return { success: false };
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
    const response = await apiClient.delete("/api/audit-logs");
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
