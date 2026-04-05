import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, dialog, ipcMain } from "electron";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  appendAuditLog,
  backupDatabase,
  countUsersByRole,
  createCategory,
  createInventory,
  createSeries,
  createShape,
  createSoldItem,
  createUserRecord,
  deleteUserRecord,
  findUserByEmail,
  findUserById,
  deleteInventory,
  getCategories,
  getCompanySettings,
  getDatabasePath,
  getDashboardStats,
  getInventoryItemById,
  getInventoryItems,
  getSeries,
  getShapes,
  getSoldItems,
  getUsersList,
  undoSoldItem,
  restoreDatabase,
  saveCompanySettings,
  updateUserPasswordRecord,
  updateUserRecord,
  updateUserRoleRecord,
  updateInventory,
} from "./db.js";

const LOCAL_JWT_SECRET = "kuber-local-secret";
const LOCAL_JWT_EXPIRES_IN = "7d";

const normalizeAuthUser = (userRow) => {
  if (!userRow) {
    return null;
  }

  const userId = String(userRow.id);
  const userName = userRow.name || "";
  const userRole = userRow.role === "admin" ? "admin" : "staff";

  return {
    id: userId,
    _id: userId,
    name: userName,
    username: userName,
    email: userRow.email,
    role: userRole,
    createdAt: userRow.created_at,
  };
};

const createLocalToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    LOCAL_JWT_SECRET,
    { expiresIn: LOCAL_JWT_EXPIRES_IN }
  );
};

const extractToken = (payload) => {
  if (typeof payload === "string") {
    return payload;
  }
  return payload?.token || "";
};

const ALLOWED_CHANNELS = [
  "app:getDatabasePath",
  "auth:signin",
  "auth:signup",
  "auth:verify",
  "auth:signout",
  "auth:changePassword",
  "inventory:getAll",
  "inventory:getById",
  "inventory:create",
  "inventory:update",
  "inventory:delete",
  "inventory:search",
  "categories:getAll",
  "categories:create",
  "sold:getAll",
  "sold:create",
  "sold:undo",
  "dashboard:getStats",
  "series:getAll",
  "series:create",
  "shapes:getAll",
  "shapes:create",
  "users:getAll",
  "users:create",
  "users:delete",
  "users:updateRole",
  "users:update",
  "company:get",
  "company:save",
  "images:save",
  "backup:export",
  "backup:restore",
  "files:save",
];

const removeExistingHandlers = () => {
  for (const channel of ALLOWED_CHANNELS) {
    ipcMain.removeHandler(channel);
  }
};

const safeHandler = (handler) => async (_event, payload) => {
  try {
    return await handler(payload);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unexpected error",
    };
  }
};

const sanitizeFolderSegment = (value) => {
  if (!value || typeof value !== "string") {
    return "general";
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const sanitizeFileName = (value) => {
  if (!value || typeof value !== "string") {
    return `image-${Date.now()}`;
  }
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
};

const ensureDbExtension = (filePath) => {
  if (path.extname(filePath).toLowerCase() === ".db") {
    return filePath;
  }
  return `${filePath}.db`;
};

export const registerIpcHandlers = () => {
  removeExistingHandlers();

  ipcMain.handle(
    "app:getDatabasePath",
    safeHandler(async () => ({ success: true, path: getDatabasePath() }))
  );

  ipcMain.handle(
    "auth:signin",
    safeHandler(async (payload) => {
      const email = String(payload?.email || "").trim().toLowerCase();
      const password = String(payload?.password || "");

      if (!email || !password) {
        return { success: false, message: "Email and password are required" };
      }

      const user = findUserByEmail(email);
      if (!user) {
        return { success: false, message: "User not found" };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password || "");
      if (!isPasswordValid) {
        return { success: false, message: "Wrong password" };
      }

      const normalizedUser = normalizeAuthUser(user);
      const token = createLocalToken(normalizedUser);

      return {
        success: true,
        token,
        accessToken: token,
        user: normalizedUser,
      };
    })
  );

  ipcMain.handle(
    "auth:signup",
    safeHandler(async (payload) => {
      const name = String(payload?.name || payload?.username || "").trim();
      const email = String(payload?.email || "").trim().toLowerCase();
      const password = String(payload?.password || "");
      const role = payload?.role === "admin" ? "admin" : "staff";

      if (!name || !email || !password) {
        return { success: false, message: "Name, email and password are required" };
      }

      const existingUser = findUserByEmail(email);
      if (existingUser) {
        return { success: false, message: "Email already registered" };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const created = createUserRecord({
        name,
        email,
        passwordHash: hashedPassword,
        role,
      });

      if (!created.success) {
        return created;
      }

      appendAuditLog({
        action: "auth.signup",
        entityType: "user",
        entityId: created.data?.id,
      });

      const token = createLocalToken(created.data);

      return {
        success: true,
        token,
        accessToken: token,
        user: created.data,
      };
    })
  );

  ipcMain.handle(
    "auth:verify",
    safeHandler(async (payload) => {
      const token = extractToken(payload);
      if (!token) {
        return { success: false, message: "Token is required" };
      }

      try {
        const decoded = jwt.verify(token, LOCAL_JWT_SECRET);
        const user = findUserById(decoded?.id);
        if (!user) {
          return { success: false, message: "User not found" };
        }

        return { success: true, user: normalizeAuthUser(user) };
      } catch {
        return { success: false, message: "Invalid or expired token" };
      }
    })
  );

  ipcMain.handle(
    "auth:signout",
    safeHandler(async () => ({ success: true }))
  );

  ipcMain.handle(
    "auth:changePassword",
    safeHandler(async (payload) => {
      const userId = payload?.userId;
      const oldPassword = String(payload?.oldPassword || "");
      const newPassword = String(payload?.newPassword || "");

      if (!userId || !oldPassword || !newPassword) {
        return { success: false, message: "userId, oldPassword and newPassword are required" };
      }

      const user = findUserById(userId);
      if (!user) {
        return { success: false, message: "User not found" };
      }

      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password || "");
      if (!isOldPasswordValid) {
        return { success: false, message: "Wrong password" };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const result = updateUserPasswordRecord(userId, hashedPassword);
      if (!result.success) {
        return result;
      }

      appendAuditLog({
        action: "auth.changePassword",
        entityType: "user",
        entityId: String(userId),
      });

      return { success: true };
    })
  );

  ipcMain.handle(
    "inventory:getAll",
    safeHandler(async (params) => getInventoryItems(params || {}))
  );

  ipcMain.handle(
    "inventory:getById",
    safeHandler(async (payload) => {
      const id = typeof payload === "string" ? payload : payload?.id;
      if (!id) {
        return { success: false, data: null, message: "Inventory id is required" };
      }
      return getInventoryItemById(id);
    })
  );

  ipcMain.handle(
    "inventory:create",
    safeHandler(async (payload) => {
      const result = createInventory(payload || {});
      if (result.success) {
        appendAuditLog({
          action: "inventory.create",
          entityType: "inventory",
          entityId: result.data?._id,
          payload: result.data,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "inventory:update",
    safeHandler(async (payload) => {
      const id = payload?.id;
      if (!id) {
        return { success: false, message: "Inventory id is required" };
      }
      const result = updateInventory(id, payload?.data || {});
      if (result.success) {
        appendAuditLog({
          action: "inventory.update",
          entityType: "inventory",
          entityId: id,
          payload: payload?.data,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "inventory:delete",
    safeHandler(async (payload) => {
      const id = typeof payload === "string" ? payload : payload?.id;
      if (!id) {
        return { success: false, message: "Inventory id is required" };
      }
      const result = deleteInventory(id);
      if (result.success) {
        appendAuditLog({
          action: "inventory.delete",
          entityType: "inventory",
          entityId: id,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "inventory:search",
    safeHandler(async (payload) => {
      const query = typeof payload === "string"
        ? payload
        : (payload?.search ?? payload?.query ?? "");
      return getInventoryItems({ ...(payload || {}), search: query });
    })
  );

  ipcMain.handle(
    "categories:getAll",
    safeHandler(async (params) => getCategories(params || {}))
  );

  ipcMain.handle(
    "categories:create",
    safeHandler(async (payload) => {
      const result = createCategory(payload || {});
      if (result.success) {
        appendAuditLog({
          action: "categories.create",
          entityType: "category",
          entityId: result.data?._id,
          payload: result.data,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "series:getAll",
    safeHandler(async (params) => getSeries(params || {}))
  );

  ipcMain.handle(
    "series:create",
    safeHandler(async (payload) => {
      const result = createSeries(payload || {});
      if (result.success) {
        appendAuditLog({
          action: "series.create",
          entityType: "series",
          entityId: result.data?._id,
          payload: result.data,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "shapes:getAll",
    safeHandler(async (params) => getShapes(params || {}))
  );

  ipcMain.handle(
    "shapes:create",
    safeHandler(async (payload) => {
      const result = createShape(payload || {});
      if (result.success) {
        appendAuditLog({
          action: "shapes.create",
          entityType: "shape",
          entityId: result.data?._id,
          payload: result.data,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "users:getAll",
    safeHandler(async (params) => getUsersList(params || {}))
  );

  ipcMain.handle(
    "users:create",
    safeHandler(async (payload) => {
      const name = String(payload?.name || payload?.username || "").trim();
      const email = String(payload?.email || "").trim().toLowerCase();
      const password = String(payload?.password || "");
      const role = payload?.role === "admin" ? "admin" : "staff";

      if (!name || !email || !password) {
        return { success: false, message: "Name, email and password are required" };
      }

      if (findUserByEmail(email)) {
        return { success: false, message: "Email already registered" };
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = createUserRecord({ name, email, passwordHash, role });

      if (result.success) {
        appendAuditLog({
          action: "users.create",
          entityType: "user",
          entityId: result.data?.id,
          payload: { email: result.data?.email, role: result.data?.role },
        });
      }

      return result;
    })
  );

  ipcMain.handle(
    "users:delete",
    safeHandler(async (payload) => {
      const id = payload?.id;
      if (!id) {
        return { success: false, message: "User id is required" };
      }

      const existing = findUserById(id);
      if (!existing) {
        return { success: false, message: "User not found" };
      }

      if (existing.role === "admin" && countUsersByRole("admin") <= 1) {
        return { success: false, message: "Cannot delete the last admin user" };
      }

      const result = deleteUserRecord(id);
      if (result.success) {
        appendAuditLog({
          action: "users.delete",
          entityType: "user",
          entityId: String(id),
          payload: { email: existing.email },
        });
      }

      return result;
    })
  );

  ipcMain.handle(
    "users:updateRole",
    safeHandler(async (payload) => {
      const id = payload?.id;
      const role = payload?.role;

      if (!id || !role) {
        return { success: false, message: "User id and role are required" };
      }

      const existing = findUserById(id);
      if (!existing) {
        return { success: false, message: "User not found" };
      }

      const normalizedRole = role === "admin" ? "admin" : "staff";
      if (existing.role === "admin" && normalizedRole !== "admin" && countUsersByRole("admin") <= 1) {
        return { success: false, message: "Cannot demote the last admin user" };
      }

      const result = updateUserRoleRecord(id, normalizedRole);
      if (result.success) {
        appendAuditLog({
          action: "users.updateRole",
          entityType: "user",
          entityId: String(id),
          payload: { role: normalizedRole },
        });
      }

      return result;
    })
  );

  ipcMain.handle(
    "users:update",
    safeHandler(async (payload) => {
      const id = payload?.id;
      const data = payload?.data || {};

      if (!id) {
        return { success: false, message: "User id is required" };
      }

      const existing = findUserById(id);
      if (!existing) {
        return { success: false, message: "User not found" };
      }

      const normalizedRole = data.role === "admin" ? "admin" : data.role === "staff" ? "staff" : existing.role;
      if (existing.role === "admin" && normalizedRole !== "admin" && countUsersByRole("admin") <= 1) {
        return { success: false, message: "Cannot demote the last admin user" };
      }

      let passwordHash = undefined;
      if (data.password) {
        passwordHash = await bcrypt.hash(String(data.password), 10);
      }

      const result = updateUserRecord(id, {
        name: data.name || data.username,
        email: data.email,
        role: normalizedRole,
        passwordHash,
      });

      if (result.success) {
        appendAuditLog({
          action: "users.update",
          entityType: "user",
          entityId: String(id),
          payload: {
            email: result.data?.email,
            role: result.data?.role,
          },
        });
      }

      return result;
    })
  );

  ipcMain.handle(
    "sold:getAll",
    safeHandler(async (params) => getSoldItems(params || {}))
  );

  ipcMain.handle(
    "sold:create",
    safeHandler(async (payload) => {
      const result = createSoldItem(payload || {});
      if (result.success) {
        appendAuditLog({
          action: "sold.create",
          entityType: "sold_item",
          entityId: result.data?._id,
          payload: result.data,
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "sold:undo",
    safeHandler(async (payload) => {
      const id = typeof payload === "string" ? payload : payload?.id;
      if (!id) {
        return { success: false, message: "Sale id is required" };
      }

      const reason = payload?.reason || "Undone by admin";
      const result = undoSoldItem(id, reason);
      if (result.success) {
        appendAuditLog({
          action: "sold.undo",
          entityType: "sold_item",
          entityId: id,
          payload: { reason },
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "company:get",
    safeHandler(async () => {
      const data = getCompanySettings();
      return { success: true, data };
    })
  );

  ipcMain.handle(
    "company:save",
    safeHandler(async (payload) => {
      const result = saveCompanySettings(payload || {});
      if (result.success) {
        appendAuditLog({
          action: "company.save",
          entityType: "company",
          entityId: "1",
        });
      }
      return result;
    })
  );

  ipcMain.handle(
    "dashboard:getStats",
    safeHandler(async () => {
      const stats = getDashboardStats();
      return { success: true, data: stats };
    })
  );

  ipcMain.handle(
    "images:save",
    safeHandler(async (payload) => {
      const bytes = payload?.bytes;
      if (!Array.isArray(bytes) || bytes.length === 0) {
        return { success: false, message: "Image bytes are required" };
      }

      const safeFolder = sanitizeFolderSegment(payload?.folder || "general");
      const imagesRoot = path.join(app.getPath("userData"), "images", safeFolder);
      fs.mkdirSync(imagesRoot, { recursive: true });

      const originalName = sanitizeFileName(payload?.fileName || "image.bin");
      const ext = path.extname(originalName) || ".bin";
      const base = path.basename(originalName, ext);
      const finalName = `${base}-${Date.now()}${ext}`;
      const finalPath = path.join(imagesRoot, finalName);

      fs.writeFileSync(finalPath, Buffer.from(bytes));
      const fileUrl = pathToFileURL(finalPath).toString();

      return {
        success: true,
        data: {
          path: finalPath,
          url: fileUrl,
        },
      };
    })
  );

  ipcMain.handle(
    "backup:export",
    safeHandler(async (payload) => {
      let targetPath = typeof payload?.filePath === "string" ? payload.filePath : "";

      if (!targetPath) {
        const suggestedName = `kuber-backup-${new Date().toISOString().slice(0, 10)}.db`;
        const dialogResult = await dialog.showSaveDialog({
          title: "Backup Kuber data",
          defaultPath: path.join(app.getPath("documents"), suggestedName),
          filters: [{ name: "SQLite Database", extensions: ["db"] }],
        });

        if (dialogResult.canceled || !dialogResult.filePath) {
          return { success: false, cancelled: true, message: "Backup cancelled" };
        }

        targetPath = dialogResult.filePath;
      }

      const normalizedTarget = ensureDbExtension(targetPath);
      await backupDatabase(normalizedTarget);

      appendAuditLog({
        action: "backup.export",
        entityType: "database",
        entityId: "kuber.db",
        payload: { destination: normalizedTarget },
      });

      return {
        success: true,
        path: normalizedTarget,
        message: "Backup created successfully",
      };
    })
  );

  ipcMain.handle(
    "backup:restore",
    safeHandler(async (payload) => {
      let sourcePath = typeof payload?.filePath === "string" ? payload.filePath : "";

      if (!sourcePath) {
        const dialogResult = await dialog.showOpenDialog({
          title: "Restore Kuber data",
          properties: ["openFile"],
          filters: [{ name: "SQLite Database", extensions: ["db"] }],
        });

        if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
          return { success: false, cancelled: true, message: "Restore cancelled" };
        }

        sourcePath = dialogResult.filePaths[0];
      }

      if (!fs.existsSync(sourcePath)) {
        return { success: false, message: "Selected backup file does not exist" };
      }

      restoreDatabase(sourcePath);

      appendAuditLog({
        action: "backup.restore",
        entityType: "database",
        entityId: "kuber.db",
        payload: { source: sourcePath },
      });

      return {
        success: true,
        path: sourcePath,
        message: "Backup restored successfully",
      };
    })
  );

  ipcMain.handle(
    "files:save",
    safeHandler(async (payload) => {
      const bytes = payload?.bytes;
      const defaultFileName = sanitizeFileName(payload?.defaultFileName || `kuber-export-${Date.now()}.bin`);
      const title = typeof payload?.title === "string" && payload.title.trim().length > 0
        ? payload.title
        : "Save file";

      if (!Array.isArray(bytes) || bytes.length === 0) {
        return { success: false, message: "File bytes are required" };
      }

      const filters = Array.isArray(payload?.filters) && payload.filters.length > 0
        ? payload.filters
        : [{ name: "All Files", extensions: ["*"] }];

      const dialogResult = await dialog.showSaveDialog({
        title,
        defaultPath: path.join(app.getPath("documents"), defaultFileName),
        filters,
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return { success: false, cancelled: true, message: "Save cancelled" };
      }

      fs.writeFileSync(dialogResult.filePath, Buffer.from(bytes));

      return {
        success: true,
        path: dialogResult.filePath,
        message: "File saved successfully",
      };
    })
  );
};
