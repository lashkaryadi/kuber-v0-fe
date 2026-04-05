import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

let db = null;
let databasePath = "";

const DEFAULT_ADMIN_EMAIL = "admin@kuber.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";

const nowIso = () => new Date().toISOString();

const ensureDatabase = () => {
  if (!db) {
    throw new Error("Database is not initialized");
  }
  return db;
};

const parseRowData = (row) => {
  if (!row) {
    return null;
  }

  let payload = {};
  try {
    payload = row.data ? JSON.parse(row.data) : {};
  } catch {
    payload = {};
  }

  const normalizedId = payload._id || payload.id || row.id;
  return {
    ...payload,
    serialNumber: payload.serialNumber || row.serial_number || "",
    category: payload.category || row.category_id || null,
    shapeType: payload.shapeType || row.shape_type || "single",
    status: payload.status || row.status || "in_stock",
    createdAt: payload.createdAt || row.created_at,
    updatedAt: payload.updatedAt || row.updated_at,
    _id: normalizedId,
    id: normalizedId,
  };
};

const normalizeId = (candidate) => {
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate;
  }
  return crypto.randomUUID();
};

const normalizeRole = (role) => (role === "admin" ? "admin" : "staff");

const mapUserRow = (row) => {
  if (!row) {
    return null;
  }

  const normalizedId = String(row.id);
  const normalizedName = row.name || "";

  return {
    id: normalizedId,
    _id: normalizedId,
    name: normalizedName,
    username: normalizedName,
    email: row.email,
    role: normalizeRole(row.role),
    createdAt: row.created_at,
  };
};

const INVENTORY_STATUS_VALUES = new Set(["in_stock", "pending", "partially_sold", "sold"]);
const CUTTING_STYLE_VALUES = new Set(["A", "B", "C", "D", "E", "F", "L"]);

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toInteger = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const firstDefinedValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const clamp = (value, min, max) => {
  const numericValue = Number.isFinite(value) ? value : min;
  if (numericValue < min) {
    return min;
  }
  if (numericValue > max) {
    return max;
  }
  return numericValue;
};

const normalizeInventoryStatus = (value, fallback = "in_stock") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (!normalized) {
    return fallback;
  }

  const aliases = {
    in_stock: "in_stock",
    instock: "in_stock",
    pending: "pending",
    partially_sold: "partially_sold",
    partiallysold: "partially_sold",
    partial: "partially_sold",
    sold: "sold",
  };

  const resolved = aliases[normalized] || aliases[normalized.replace(/_/g, "")] || normalized;
  return INVENTORY_STATUS_VALUES.has(resolved) ? resolved : fallback;
};

const normalizeShapeType = (value) => (String(value || "single").toLowerCase() === "mix" ? "mix" : "single");

const normalizeCuttingStyle = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return CUTTING_STYLE_VALUES.has(normalized) ? normalized : "";
};

const extractReferenceId = (reference) => {
  if (!reference) {
    return null;
  }

  if (typeof reference === "string") {
    const trimmed = reference.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const candidate = reference._id || reference.id;
  if (candidate === null || candidate === undefined) {
    return null;
  }

  const normalized = String(candidate).trim();
  return normalized.length > 0 ? normalized : null;
};

const getCategoryRecordById = (categoryId) => {
  const sqlite = ensureDatabase();
  const normalizedId = extractReferenceId(categoryId);
  if (!normalizedId) {
    return null;
  }

  const row = sqlite.prepare("SELECT * FROM categories WHERE id = ?").get(normalizedId);
  if (!row) {
    return null;
  }

  const parsed = parseRowData(row) || {};
  return {
    _id: parsed._id || row.id,
    id: parsed.id || row.id,
    name: parsed.name || row.name || "",
    code: parsed.code || "",
  };
};

const getSeriesRecordById = (seriesId) => {
  const sqlite = ensureDatabase();
  const normalizedId = extractReferenceId(seriesId);
  if (!normalizedId) {
    return null;
  }

  const row = sqlite.prepare("SELECT * FROM series WHERE id = ?").get(normalizedId);
  if (!row) {
    return null;
  }

  const parsed = parseRowData(row) || {};
  return {
    _id: parsed._id || row.id,
    id: parsed.id || row.id,
    name: parsed.name || row.name || "",
  };
};

const normalizeCategoryReference = (reference) => {
  const id = extractReferenceId(reference);
  if (!id) {
    return null;
  }

  const fromDb = getCategoryRecordById(id);
  if (fromDb) {
    return {
      _id: fromDb._id,
      id: fromDb.id,
      name: fromDb.name,
      code: fromDb.code || undefined,
    };
  }

  if (typeof reference === "object" && reference) {
    return {
      _id: id,
      id,
      name: String(reference.name || "").trim(),
      code: String(reference.code || "").trim() || undefined,
    };
  }

  return {
    _id: id,
    id,
    name: "",
  };
};

const normalizeSeriesReference = (reference) => {
  const id = extractReferenceId(reference);
  if (!id) {
    return null;
  }

  const fromDb = getSeriesRecordById(id);
  if (fromDb) {
    return {
      _id: fromDb._id,
      id: fromDb.id,
      name: fromDb.name,
    };
  }

  if (typeof reference === "object" && reference) {
    return {
      _id: id,
      id,
      name: String(reference.name || "").trim(),
    };
  }

  return {
    _id: id,
    id,
    name: "",
  };
};

const buildCategoryCode = (category) => {
  const codeFromPayload = String(category?.code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  if (codeFromPayload) {
    return codeFromPayload;
  }

  const categoryName = String(category?.name || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

  return categoryName || "GEN";
};

const normalizeDimensions = (dimensions) => {
  const unit = String(dimensions?.unit || "mm").toLowerCase() === "cm" ? "cm" : "mm";

  return {
    min: {
      length: Math.max(0, toFloat(dimensions?.min?.length, 0)),
      width: Math.max(0, toFloat(dimensions?.min?.width, 0)),
    },
    max: {
      length: Math.max(0, toFloat(dimensions?.max?.length, 0)),
      width: Math.max(0, toFloat(dimensions?.max?.width, 0)),
    },
    unit,
  };
};

const normalizeShapeEntry = (shape = {}) => {
  const normalizedName = String(shape.shape || "").trim();
  return {
    shape: normalizedName,
    pieces: Math.max(0, toInteger(shape.pieces, 0)),
    weight: Math.max(0, toFloat(shape.weight, 0)),
    dimensionMin: {
      length: Math.max(0, toFloat(shape.dimensionMin?.length, 0)),
      width: Math.max(0, toFloat(shape.dimensionMin?.width, 0)),
    },
    dimensionMax: {
      length: Math.max(0, toFloat(shape.dimensionMax?.length, 0)),
      width: Math.max(0, toFloat(shape.dimensionMax?.width, 0)),
    },
  };
};

const normalizeShapes = (shapes = []) => {
  if (!Array.isArray(shapes)) {
    return [];
  }
  return shapes
    .map((shape) => normalizeShapeEntry(shape))
    .filter((shape) => shape.shape.length > 0);
};

const computeTotalPrice = (saleCode, availableWeight) => {
  const parsed = Number.parseFloat(String(saleCode || ""));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const totalPrice = parsed * toFloat(availableWeight, 0);
  return Number(totalPrice.toFixed(2));
};

const deriveInventoryStatus = ({
  requestedStatus,
  previousStatus,
  totalPieces,
  totalWeight,
  availablePieces,
  availableWeight,
}) => {
  const normalizedPrevious = normalizeInventoryStatus(previousStatus, "in_stock");
  const normalizedRequested = requestedStatus === undefined
    ? null
    : normalizeInventoryStatus(requestedStatus, normalizedPrevious);

  if ((totalPieces > 0 || totalWeight > 0) && availablePieces <= 0 && availableWeight <= 0) {
    return "sold";
  }

  if (availablePieces < totalPieces || availableWeight < totalWeight) {
    if (normalizedRequested === "pending") {
      return "pending";
    }
    return "partially_sold";
  }

  if (normalizedRequested) {
    return normalizedRequested;
  }

  if (normalizedPrevious === "pending") {
    return "pending";
  }

  return "in_stock";
};

const generateInventorySerialNumber = ({ category, cuttingStyle }) => {
  const sqlite = ensureDatabase();
  const categoryCode = buildCategoryCode(category);
  const styleCode = normalizeCuttingStyle(cuttingStyle);
  const prefix = `#${categoryCode}${styleCode}`;

  const rows = sqlite
    .prepare("SELECT serial_number FROM inventory WHERE serial_number LIKE ?")
    .all(`${prefix}%`);

  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  let maxSequence = 0;

  for (const row of rows) {
    const serial = String(row?.serial_number || "").trim();
    const match = serial.match(regex);
    if (!match) {
      continue;
    }
    const sequence = Number.parseInt(match[1], 10);
    if (Number.isFinite(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
};

const normalizeInventoryForRead = (rawRecord = {}) => {
  const originalSnapshot = JSON.stringify(rawRecord);
  const shapeType = normalizeShapeType(firstDefinedValue(rawRecord.shapeType, rawRecord.shape_type));

  const category = normalizeCategoryReference(
    firstDefinedValue(rawRecord.category, rawRecord.categoryId, rawRecord.category_id)
  );
  const series = normalizeSeriesReference(
    firstDefinedValue(rawRecord.series, rawRecord.seriesId, rawRecord.series_id)
  );
  const cuttingStyle = normalizeCuttingStyle(
    firstDefinedValue(rawRecord.cuttingStyle, rawRecord.cutting_style)
  );

  const rawShapes = firstDefinedValue(rawRecord.shapes, rawRecord.shapeBreakdown, rawRecord.shape_breakdown);
  const normalizedShapes = shapeType === "mix" ? normalizeShapes(rawShapes) : [];
  const singleShape = shapeType === "single"
    ? (String(firstDefinedValue(rawRecord.singleShape, rawRecord.single_shape) || "").trim() || null)
    : null;

  const totalPiecesFromRecord = firstDefinedValue(
    rawRecord.totalPieces,
    rawRecord.total_pieces,
    rawRecord.piecesTotal,
    rawRecord.pieces_total
  );
  const totalWeightFromRecord = firstDefinedValue(
    rawRecord.totalWeight,
    rawRecord.total_weight,
    rawRecord.weightTotal,
    rawRecord.weight_total
  );

  const totalPieces = shapeType === "mix"
    ? normalizedShapes.reduce((sum, shape) => sum + shape.pieces, 0)
    : Math.max(0, toInteger(totalPiecesFromRecord, 0));
  const totalWeight = shapeType === "mix"
    ? normalizedShapes.reduce((sum, shape) => sum + shape.weight, 0)
    : Math.max(0, toFloat(totalWeightFromRecord, 0));

  const availablePiecesFromRecord = firstDefinedValue(
    rawRecord.availablePieces,
    rawRecord.available_pieces,
    rawRecord.piecesAvailable,
    rawRecord.pieces_available
  );
  const availableWeightFromRecord = firstDefinedValue(
    rawRecord.availableWeight,
    rawRecord.available_weight,
    rawRecord.weightAvailable,
    rawRecord.weight_available
  );

  const hasExplicitAvailablePieces = availablePiecesFromRecord !== undefined;
  const hasExplicitAvailableWeight = availableWeightFromRecord !== undefined;

  let availablePieces = Math.max(0, toInteger(availablePiecesFromRecord, totalPieces));
  let availableWeight = Math.max(0, toFloat(availableWeightFromRecord, totalWeight));

  const normalizedStatus = normalizeInventoryStatus(rawRecord.status, "in_stock");
  if (["in_stock", "pending"].includes(normalizedStatus)) {
    if (totalPieces > 0 && !hasExplicitAvailablePieces && availablePieces <= 0) {
      availablePieces = totalPieces;
    }
    if (totalWeight > 0 && !hasExplicitAvailableWeight && availableWeight <= 0) {
      availableWeight = totalWeight;
    }
  }

  availablePieces = clamp(availablePieces, 0, totalPieces);
  availableWeight = clamp(availableWeight, 0, totalWeight);

  const status = deriveInventoryStatus({
    requestedStatus: normalizedStatus,
    previousStatus: normalizedStatus,
    totalPieces,
    totalWeight,
    availablePieces,
    availableWeight,
  });

  const serialNumber = String(
    firstDefinedValue(rawRecord.serialNumber, rawRecord.serial_number, rawRecord.serial) || ""
  ).trim() || generateInventorySerialNumber({
    category,
    cuttingStyle,
  });

  const purchaseCode = String(firstDefinedValue(rawRecord.purchaseCode, rawRecord.purchase_code) || "");
  const saleCode = String(firstDefinedValue(rawRecord.saleCode, rawRecord.sale_code) || "");
  const purchasePriceValue = firstDefinedValue(rawRecord.purchasePrice, rawRecord.purchase_price);
  const salePriceValue = firstDefinedValue(rawRecord.salePrice, rawRecord.sale_price);

  const normalized = {
    ...rawRecord,
    category,
    series,
    shapeType,
    singleShape,
    shapes: normalizedShapes,
    totalPieces,
    totalWeight,
    availablePieces,
    availableWeight,
    cuttingStyle,
    serialNumber,
    purchaseCode,
    saleCode,
    purchasePrice: purchasePriceValue === undefined || purchasePriceValue === null || purchasePriceValue === ""
      ? null
      : toFloat(purchasePriceValue, 0),
    salePrice: salePriceValue === undefined || salePriceValue === null || salePriceValue === ""
      ? null
      : toFloat(salePriceValue, 0),
    dimensions: normalizeDimensions(rawRecord.dimensions),
    certification: String(firstDefinedValue(rawRecord.certification, rawRecord.certificate) || ""),
    location: String(rawRecord.location || ""),
    mineName: String(firstDefinedValue(rawRecord.mineName, rawRecord.mine_name, rawRecord.mineSource, rawRecord.mine_source) || ""),
    lines: firstDefinedValue(rawRecord.lines, rawRecord.line) !== undefined
      ? Math.max(0, toInteger(firstDefinedValue(rawRecord.lines, rawRecord.line), null))
      : null,
    grossWeight: firstDefinedValue(rawRecord.grossWeight, rawRecord.gross_weight) !== undefined
      ? Math.max(0, toFloat(firstDefinedValue(rawRecord.grossWeight, rawRecord.gross_weight), null))
      : null,
    status,
    description: String(rawRecord.description || ""),
    images: Array.isArray(rawRecord.images) ? rawRecord.images.filter(Boolean) : [],
    totalPrice: computeTotalPrice(saleCode, availableWeight),
    createdAt: firstDefinedValue(rawRecord.createdAt, rawRecord.created_at) || nowIso(),
    updatedAt: firstDefinedValue(rawRecord.updatedAt, rawRecord.updated_at) || nowIso(),
  };

  const nextSnapshot = JSON.stringify(normalized);
  return {
    record: normalized,
    changed: originalSnapshot !== nextSnapshot,
  };
};

const normalizeInventoryForCreate = (payload = {}) => {
  const id = normalizeId(payload._id || payload.id);
  const createdAt = payload.createdAt || nowIso();
  const updatedAt = nowIso();

  const baseRecord = {
    ...payload,
    _id: id,
    id,
    createdAt,
    updatedAt,
  };

  const normalizedRead = normalizeInventoryForRead(baseRecord).record;

  const explicitAvailablePieces = Object.prototype.hasOwnProperty.call(payload, "availablePieces")
    ? Math.max(0, toInteger(payload.availablePieces, normalizedRead.totalPieces))
    : normalizedRead.totalPieces;
  const explicitAvailableWeight = Object.prototype.hasOwnProperty.call(payload, "availableWeight")
    ? Math.max(0, toFloat(payload.availableWeight, normalizedRead.totalWeight))
    : normalizedRead.totalWeight;

  normalizedRead.availablePieces = clamp(explicitAvailablePieces, 0, normalizedRead.totalPieces);
  normalizedRead.availableWeight = clamp(explicitAvailableWeight, 0, normalizedRead.totalWeight);

  const requestedStatus = Object.prototype.hasOwnProperty.call(payload, "status")
    ? payload.status
    : "in_stock";

  normalizedRead.status = deriveInventoryStatus({
    requestedStatus,
    previousStatus: "in_stock",
    totalPieces: normalizedRead.totalPieces,
    totalWeight: normalizedRead.totalWeight,
    availablePieces: normalizedRead.availablePieces,
    availableWeight: normalizedRead.availableWeight,
  });

  if (["in_stock", "pending"].includes(normalizedRead.status)) {
    if (normalizedRead.totalPieces > 0 && normalizedRead.availablePieces <= 0) {
      normalizedRead.availablePieces = normalizedRead.totalPieces;
    }
    if (normalizedRead.totalWeight > 0 && normalizedRead.availableWeight <= 0) {
      normalizedRead.availableWeight = normalizedRead.totalWeight;
    }
  }

  if (!String(normalizedRead.serialNumber || "").trim()) {
    normalizedRead.serialNumber = generateInventorySerialNumber({
      category: normalizedRead.category,
      cuttingStyle: normalizedRead.cuttingStyle,
    });
  }

  normalizedRead.totalPrice = computeTotalPrice(normalizedRead.saleCode, normalizedRead.availableWeight);
  normalizedRead.createdAt = createdAt;
  normalizedRead.updatedAt = updatedAt;

  return normalizedRead;
};

const normalizeInventoryForUpdate = (existingRecord = {}, payload = {}) => {
  const id = normalizeId(existingRecord._id || existingRecord.id);
  const previous = normalizeInventoryForRead(existingRecord).record;
  const mergedBase = {
    ...previous,
    ...payload,
    _id: id,
    id,
    serialNumber: previous.serialNumber,
    createdAt: previous.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  const normalized = normalizeInventoryForRead(mergedBase).record;

  const previousTotalPieces = Math.max(0, toInteger(previous.totalPieces, 0));
  const previousTotalWeight = Math.max(0, toFloat(previous.totalWeight, 0));
  const previousAvailablePieces = clamp(Math.max(0, toInteger(previous.availablePieces, previousTotalPieces)), 0, previousTotalPieces);
  const previousAvailableWeight = clamp(Math.max(0, toFloat(previous.availableWeight, previousTotalWeight)), 0, previousTotalWeight);
  const previousStatus = normalizeInventoryStatus(previous.status, "in_stock");

  let soldPieces = Math.max(previousTotalPieces - previousAvailablePieces, 0);
  let soldWeight = Math.max(previousTotalWeight - previousAvailableWeight, 0);

  if (["in_stock", "pending"].includes(previousStatus)) {
    soldPieces = 0;
    soldWeight = 0;
  } else if (previousStatus === "sold") {
    soldPieces = previousTotalPieces;
    soldWeight = previousTotalWeight;
  }

  const quantityFieldsTouched = ["shapeType", "singleShape", "shapes", "totalPieces", "totalWeight"]
    .some((field) => Object.prototype.hasOwnProperty.call(payload, field));

  const explicitAvailabilityTouched = Object.prototype.hasOwnProperty.call(payload, "availablePieces")
    || Object.prototype.hasOwnProperty.call(payload, "availableWeight");

  if (explicitAvailabilityTouched) {
    const explicitPieces = Object.prototype.hasOwnProperty.call(payload, "availablePieces")
      ? Math.max(0, toInteger(payload.availablePieces, previousAvailablePieces))
      : previousAvailablePieces;
    const explicitWeight = Object.prototype.hasOwnProperty.call(payload, "availableWeight")
      ? Math.max(0, toFloat(payload.availableWeight, previousAvailableWeight))
      : previousAvailableWeight;

    normalized.availablePieces = clamp(explicitPieces, 0, normalized.totalPieces);
    normalized.availableWeight = clamp(explicitWeight, 0, normalized.totalWeight);
  } else if (quantityFieldsTouched || previousAvailablePieces <= 0 || previousAvailableWeight <= 0) {
    normalized.availablePieces = clamp(Math.max(normalized.totalPieces - soldPieces, 0), 0, normalized.totalPieces);
    normalized.availableWeight = clamp(Math.max(normalized.totalWeight - soldWeight, 0), 0, normalized.totalWeight);
  } else {
    normalized.availablePieces = clamp(previousAvailablePieces, 0, normalized.totalPieces);
    normalized.availableWeight = clamp(previousAvailableWeight, 0, normalized.totalWeight);
  }

  const requestedStatus = Object.prototype.hasOwnProperty.call(payload, "status")
    ? payload.status
    : undefined;

  normalized.status = deriveInventoryStatus({
    requestedStatus,
    previousStatus,
    totalPieces: normalized.totalPieces,
    totalWeight: normalized.totalWeight,
    availablePieces: normalized.availablePieces,
    availableWeight: normalized.availableWeight,
  });

  normalized.totalPrice = computeTotalPrice(normalized.saleCode, normalized.availableWeight);
  normalized.serialNumber = previous.serialNumber || normalized.serialNumber;
  normalized.updatedAt = nowIso();

  return normalized;
};

const persistInventoryRecord = (record, options = {}) => {
  const sqlite = ensureDatabase();
  const insert = options.insert === true;

  const payload = {
    id: normalizeId(record._id || record.id),
    serialNumber: String(record.serialNumber || "").trim() || null,
    categoryId: extractReferenceId(record.category),
    shapeType: normalizeShapeType(record.shapeType),
    status: normalizeInventoryStatus(record.status, "in_stock"),
    lines: record.lines !== null && record.lines !== undefined ? Math.max(0, toInteger(record.lines, null)) : null,
    grossWeight: record.grossWeight !== null && record.grossWeight !== undefined ? Math.max(0, toFloat(record.grossWeight, null)) : null,
    data: JSON.stringify(record),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || nowIso(),
  };

  if (insert) {
    sqlite
      .prepare(`
        INSERT INTO inventory (id, serial_number, category_id, shape_type, status, lines, gross_weight, data, created_at, updated_at)
        VALUES (@id, @serialNumber, @categoryId, @shapeType, @status, @lines, @grossWeight, @data, @createdAt, @updatedAt)
      `)
      .run(payload);
    return;
  }

  sqlite
    .prepare(`
      UPDATE inventory
      SET serial_number = @serialNumber,
          category_id = @categoryId,
          shape_type = @shapeType,
          status = @status,
          lines = @lines,
          gross_weight = @grossWeight,
          data = @data,
          updated_at = @updatedAt
      WHERE id = @id
    `)
    .run(payload);
};

const getSortValue = (item, sortBy) => {
  if (sortBy === "category") {
    return String(item?.category?.name || "").toLowerCase();
  }
  if (sortBy === "series") {
    return String(item?.series?.name || "").toLowerCase();
  }
  return item?.[sortBy];
};

const sortInventoryItems = (items, sortBy, sortOrder) => {
  const activeSortBy = typeof sortBy === "string" && sortBy.trim().length > 0 ? sortBy : "createdAt";
  const multiplier = String(sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = getSortValue(left, activeSortBy);
    const rightValue = getSortValue(right, activeSortBy);

    if (typeof leftValue === "number" || typeof rightValue === "number") {
      const numericLeft = toFloat(leftValue, 0);
      const numericRight = toFloat(rightValue, 0);
      return (numericLeft - numericRight) * multiplier;
    }

    const leftDate = Date.parse(String(leftValue || ""));
    const rightDate = Date.parse(String(rightValue || ""));
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && /at$/i.test(activeSortBy)) {
      return (leftDate - rightDate) * multiplier;
    }

    return String(leftValue || "").localeCompare(String(rightValue || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * multiplier;
  });
};

const itemMatchesInventoryFilters = (item, params = {}) => {
  if (params.category && params.category !== "ALL") {
    const categoryId = extractReferenceId(item.category);
    if (String(categoryId || "") !== String(params.category)) {
      return false;
    }
  }

  if (params.status && params.status !== "All Status") {
    const normalizedRequestedStatuses = String(params.status)
      .split(",")
      .map((entry) => normalizeInventoryStatus(entry, ""))
      .filter(Boolean);

    if (normalizedRequestedStatuses.length > 0) {
      const normalizedItemStatus = normalizeInventoryStatus(item.status, "in_stock");
      if (!normalizedRequestedStatuses.includes(normalizedItemStatus)) {
        return false;
      }
    }
  }

  if (params.shape && params.shape !== "ALL" && params.shape !== "All Shapes") {
    const requestedShape = String(params.shape).toLowerCase();
    if (item.shapeType === "single") {
      if (String(item.singleShape || "").toLowerCase() !== requestedShape) {
        return false;
      }
    } else {
      const shapeNames = Array.isArray(item.shapes)
        ? item.shapes.map((shape) => String(shape.shape || "").toLowerCase())
        : [];
      if (!shapeNames.includes(requestedShape)) {
        return false;
      }
    }
  }

  if (params.cuttingStyle && params.cuttingStyle !== "ALL") {
    if (String(item.cuttingStyle || "") !== String(params.cuttingStyle)) {
      return false;
    }
  }

  if (params.series && params.series !== "ALL") {
    const seriesId = extractReferenceId(item.series);
    if (String(seriesId || "") !== String(params.series)) {
      return false;
    }
  }

  if (params.lotType && params.lotType !== "ALL") {
    if (String(item.shapeType || "") !== String(params.lotType)) {
      return false;
    }
  }

  const totalWeight = toFloat(item.totalWeight, 0);
  const totalPieces = toInteger(item.totalPieces, 0);

  if (params.minWeight !== undefined && params.minWeight !== "" && totalWeight < toFloat(params.minWeight, 0)) {
    return false;
  }
  if (params.maxWeight !== undefined && params.maxWeight !== "" && totalWeight > toFloat(params.maxWeight, Number.MAX_SAFE_INTEGER)) {
    return false;
  }
  if (params.minPieces !== undefined && params.minPieces !== "" && totalPieces < toInteger(params.minPieces, 0)) {
    return false;
  }
  if (params.maxPieces !== undefined && params.maxPieces !== "" && totalPieces > toInteger(params.maxPieces, Number.MAX_SAFE_INTEGER)) {
    return false;
  }

  return true;
};

const normalizeSoldShapeEntry = (shape = {}) => {
  const pieces = Math.max(0, toInteger(shape.pieces, 0));
  const weight = Math.max(0, toFloat(shape.weight, 0));
  const pricePerCarat = Math.max(0, toFloat(shape.pricePerCarat, 0));
  const fallbackLineTotal = Number((weight * pricePerCarat).toFixed(2));

  return {
    shape: String(shape.shape || shape.shapeName || "").trim(),
    pieces,
    weight,
    pricePerCarat,
    lineTotal: Number(toFloat(shape.lineTotal, fallbackLineTotal).toFixed(2)),
  };
};

const generateSaleReference = () => {
  const sqlite = ensureDatabase();
  const row = sqlite.prepare("SELECT COUNT(*) AS total FROM sold_items").get();
  const nextSequence = Number(row?.total || 0) + 1;
  return `SL-${String(nextSequence).padStart(6, "0")}`;
};

const ensureUsersTableSchema = () => {
  const sqlite = ensureDatabase();
  const tableExists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();

  if (tableExists) {
    const columns = sqlite.prepare("PRAGMA table_info(users)").all();
    const columnNames = new Set(columns.map((column) => String(column.name).toLowerCase()));
    const requiredColumns = ["id", "name", "email", "password", "role", "created_at"];

    const hasRequiredColumns = requiredColumns.every((column) => columnNames.has(column));
    const idColumn = columns.find((column) => String(column.name).toLowerCase() === "id");
    const idLooksInteger = idColumn
      ? String(idColumn.type || "").toUpperCase().includes("INT")
      : false;

    if (!hasRequiredColumns || !idLooksInteger) {
      const legacyTableName = `users_legacy_${Date.now()}`;
      sqlite.exec(`ALTER TABLE users RENAME TO ${legacyTableName}`);
    }
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
};

const ensureDefaultAdminUser = () => {
  const sqlite = ensureDatabase();
  const existingAdmin = sqlite
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(DEFAULT_ADMIN_EMAIL);

  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
    sqlite
      .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run("Admin", DEFAULT_ADMIN_EMAIL, hashedPassword, "admin");
  }
};

const runStatusBackfillMigration = () => {
  const sqlite = ensureDatabase();
  const schemaVersion = Number(sqlite.pragma("user_version", { simple: true }) || 0);

  if (schemaVersion >= 2) {
    return;
  }

  const rows = sqlite.prepare("SELECT * FROM inventory").all();
  const migratedAt = nowIso();

  for (const row of rows) {
    const parsed = parseRowData(row) || {};
    const normalized = normalizeInventoryForRead(parsed).record;

    persistInventoryRecord({
      ...normalized,
      updatedAt: migratedAt,
    });
  }

  sqlite.pragma("user_version = 2");
};

const runMigrations = () => {
  const sqlite = ensureDatabase();

  // Add new columns if they don't exist
  try {
    sqlite.exec(`ALTER TABLE inventory ADD COLUMN lines INTEGER DEFAULT NULL`);
  } catch (e) {
    // Column already exists
  }

  try {
    sqlite.exec(`ALTER TABLE inventory ADD COLUMN gross_weight REAL DEFAULT NULL`);
  } catch (e) {
    // Column already exists
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      serial_number TEXT,
      category_id TEXT,
      shape_type TEXT,
      status TEXT,
      lines INTEGER DEFAULT NULL,
      gross_weight REAL DEFAULT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shapes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sold_items (
      id TEXT PRIMARY KEY,
      inventory_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      payload TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_serial ON inventory(serial_number);
    CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
    CREATE INDEX IF NOT EXISTS idx_sold_inventory ON sold_items(inventory_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_shapes_name ON shapes(name);
  `);

  ensureUsersTableSchema();
  ensureDefaultAdminUser();
  runStatusBackfillMigration();
};

export const initializeDatabase = (userDataPath) => {
  if (db) {
    return db;
  }

  fs.mkdirSync(userDataPath, { recursive: true });
  databasePath = path.join(userDataPath, "kuber.db");

  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations();
  return db;
};

export const getDatabasePath = () => databasePath;

export const appendAuditLog = ({ action, entityType, entityId, payload }) => {
  const sqlite = ensureDatabase();
  const stmt = sqlite.prepare(`
    INSERT INTO audit_logs (id, action, entity_type, entity_id, payload, created_at)
    VALUES (@id, @action, @entityType, @entityId, @payload, @createdAt)
  `);

  stmt.run({
    id: crypto.randomUUID(),
    action,
    entityType: entityType || null,
    entityId: entityId || null,
    payload: payload ? JSON.stringify(payload) : null,
    createdAt: nowIso(),
  });
};

export const getInventoryItems = (params = {}) => {
  const sqlite = ensureDatabase();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(params.limit) || 50));
  const offset = (page - 1) * limit;
  const search = typeof params.search === "string" ? params.search.trim() : "";

  const queryBindings = search ? { like: `%${search}%` } : {};
  const whereClause = search
    ? "WHERE serial_number LIKE @like OR data LIKE @like"
    : "";

  const rows = sqlite
    .prepare(`
      SELECT *
      FROM inventory
      ${whereClause}
      ORDER BY datetime(updated_at) DESC
    `)
    .all(queryBindings);

  const normalizedRows = rows.map((row) => {
    const parsed = parseRowData(row) || {};
    const normalizedResult = normalizeInventoryForRead(parsed);
    if (normalizedResult.changed) {
      const repaired = {
        ...normalizedResult.record,
        updatedAt: nowIso(),
      };
      persistInventoryRecord(repaired);
      return repaired;
    }
    return normalizedResult.record;
  });

  const filteredRows = normalizedRows.filter((item) => itemMatchesInventoryFilters(item, params));
  const sortedRows = sortInventoryItems(filteredRows, params.sortBy, params.sortOrder);
  const paginatedRows = sortedRows.slice(offset, offset + limit);
  const total = sortedRows.length;

  return {
    success: true,
    data: paginatedRows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getInventoryItemById = (id) => {
  const sqlite = ensureDatabase();
  const row = sqlite.prepare("SELECT * FROM inventory WHERE id = ?").get(id);

  if (!row) {
    return { success: false, data: null, message: "Inventory item not found" };
  }

  const parsed = parseRowData(row) || {};
  const normalizedResult = normalizeInventoryForRead(parsed);

  if (normalizedResult.changed) {
    const repaired = {
      ...normalizedResult.record,
      updatedAt: nowIso(),
    };
    persistInventoryRecord(repaired);
    return { success: true, data: repaired };
  }

  return { success: true, data: normalizedResult.record };
};

export const createInventory = (payload = {}) => {
  try {
    const record = normalizeInventoryForCreate(payload);
    persistInventoryRecord(record, { insert: true });
    return { success: true, data: record };
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : "Failed to create inventory item",
    };
  }
};

export const updateInventory = (id, payload = {}) => {
  const sqlite = ensureDatabase();
  const existing = sqlite.prepare("SELECT * FROM inventory WHERE id = ?").get(id);

  if (!existing) {
    return { success: false, data: null, message: "Inventory item not found" };
  }

  try {
    const existingData = normalizeInventoryForRead(parseRowData(existing) || {}).record;
    const merged = normalizeInventoryForUpdate(existingData, payload);
    persistInventoryRecord(merged);
    return { success: true, data: merged };
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : "Failed to update inventory item",
    };
  }
};

export const deleteInventory = (id) => {
  const sqlite = ensureDatabase();
  const result = sqlite.prepare("DELETE FROM inventory WHERE id = ?").run(id);

  if (result.changes === 0) {
    return { success: false, message: "Inventory item not found" };
  }

  return { success: true, data: { id } };
};

export const getCategories = (params = {}) => {
  const sqlite = ensureDatabase();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(params.limit) || 100));
  const offset = (page - 1) * limit;
  const search = typeof params.search === "string" ? params.search.trim() : "";

  const queryBindings = search ? { like: `%${search}%` } : {};
  const whereClause = search ? "WHERE name LIKE @like OR data LIKE @like" : "";

  const totalRow = sqlite
    .prepare(`SELECT COUNT(*) AS total FROM categories ${whereClause}`)
    .get(queryBindings);

  const rows = sqlite
    .prepare(`
      SELECT *
      FROM categories
      ${whereClause}
      ORDER BY datetime(updated_at) DESC
      LIMIT @limit OFFSET @offset
    `)
    .all({ ...queryBindings, limit, offset });

  return {
    success: true,
    data: rows.map((row) => {
      const parsed = parseRowData(row) || {};
      return {
        ...parsed,
        id: parsed.id || row.id,
        _id: parsed._id || row.id,
        name: parsed.name || row.name,
      };
    }),
    meta: {
      page,
      limit,
      total: Number(totalRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)),
    },
  };
};

export const createCategory = (payload = {}) => {
  const sqlite = ensureDatabase();
  const id = normalizeId(payload._id || payload.id);
  const createdAt = payload.createdAt || nowIso();
  const updatedAt = nowIso();

  const record = {
    ...payload,
    id,
    _id: id,
    createdAt,
    updatedAt,
  };

  sqlite
    .prepare(`
      INSERT INTO categories (id, name, data, created_at, updated_at)
      VALUES (@id, @name, @data, @createdAt, @updatedAt)
    `)
    .run({
      id,
      name: record.name,
      data: JSON.stringify(record),
      createdAt,
      updatedAt,
    });

  return { success: true, data: record };
};

export const getSeries = (params = {}) => {
  const sqlite = ensureDatabase();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(params.limit) || 100));
  const offset = (page - 1) * limit;
  const search = typeof params.search === "string" ? params.search.trim() : "";

  const queryBindings = search ? { like: `%${search}%` } : {};
  const whereClause = search ? "WHERE name LIKE @like OR data LIKE @like" : "";

  const totalRow = sqlite
    .prepare(`SELECT COUNT(*) AS total FROM series ${whereClause}`)
    .get(queryBindings);

  const rows = sqlite
    .prepare(`
      SELECT *
      FROM series
      ${whereClause}
      ORDER BY datetime(updated_at) DESC
      LIMIT @limit OFFSET @offset
    `)
    .all({ ...queryBindings, limit, offset });

  return {
    success: true,
    data: rows.map(parseRowData),
    meta: {
      page,
      limit,
      total: Number(totalRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)),
    },
  };
};

export const createSeries = (payload = {}) => {
  const sqlite = ensureDatabase();
  const id = normalizeId(payload._id || payload.id);
  const createdAt = payload.createdAt || nowIso();
  const updatedAt = nowIso();

  const record = {
    ...payload,
    id,
    _id: id,
    createdAt,
    updatedAt,
  };

  sqlite
    .prepare(`
      INSERT INTO series (id, name, data, created_at, updated_at)
      VALUES (@id, @name, @data, @createdAt, @updatedAt)
    `)
    .run({
      id,
      name: record.name,
      data: JSON.stringify(record),
      createdAt,
      updatedAt,
    });

  return { success: true, data: record };
};

export const getShapes = (params = {}) => {
  const sqlite = ensureDatabase();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(params.limit) || 100));
  const offset = (page - 1) * limit;
  const search = typeof params.search === "string" ? params.search.trim() : "";

  const queryBindings = search ? { like: `%${search}%` } : {};
  const whereClause = search ? "WHERE name LIKE @like OR data LIKE @like" : "";

  const totalRow = sqlite
    .prepare(`SELECT COUNT(*) AS total FROM shapes ${whereClause}`)
    .get(queryBindings);

  const rows = sqlite
    .prepare(`
      SELECT *
      FROM shapes
      ${whereClause}
      ORDER BY datetime(updated_at) DESC
      LIMIT @limit OFFSET @offset
    `)
    .all({ ...queryBindings, limit, offset });

  return {
    success: true,
    data: rows.map(parseRowData),
    meta: {
      page,
      limit,
      total: Number(totalRow?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)),
    },
  };
};

export const createShape = (payload = {}) => {
  const sqlite = ensureDatabase();
  const id = normalizeId(payload._id || payload.id);
  const createdAt = payload.createdAt || nowIso();
  const updatedAt = nowIso();

  const normalizedName = String(payload.name || "").trim();
  if (!normalizedName) {
    return { success: false, message: "Shape name is required" };
  }

  const record = {
    ...payload,
    name: normalizedName,
    id,
    _id: id,
    createdAt,
    updatedAt,
  };

  try {
    sqlite
      .prepare(`
        INSERT INTO shapes (id, name, data, created_at, updated_at)
        VALUES (@id, @name, @data, @createdAt, @updatedAt)
      `)
      .run({
        id,
        name: record.name,
        data: JSON.stringify(record),
        createdAt,
        updatedAt,
      });

    return { success: true, data: record };
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return { success: false, message: "Shape already exists" };
    }
    throw error;
  }
};

export const getSoldItems = (params = {}) => {
  const sqlite = ensureDatabase();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(params.limit) || 100));
  const offset = (page - 1) * limit;

  const rows = sqlite
    .prepare(`
      SELECT *
      FROM sold_items
      ORDER BY datetime(updated_at) DESC
    `)
    .all();

  const includeCancelled = String(params.includeCancelled || "false") === "true";
  const search = String(params.search || "").trim().toLowerCase();

  const normalizedRows = rows.map((row) => parseRowData(row) || {});

  const filteredRows = normalizedRows.filter((row) => {
    if (!includeCancelled && row.cancelled) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = JSON.stringify({
      saleRef: row.saleRef,
      invoiceNumber: row.invoiceNumber,
      customer: row.customer,
      serialNumber: row.inventoryItem?.serialNumber,
    }).toLowerCase();

    return haystack.includes(search);
  });

  const sortDirection = String(params.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  const sortedRows = [...filteredRows].sort((left, right) => {
    const leftTime = Date.parse(String(left.soldAt || left.soldDate || left.createdAt || ""));
    const rightTime = Date.parse(String(right.soldAt || right.soldDate || right.createdAt || ""));
    const normalizedLeft = Number.isFinite(leftTime) ? leftTime : 0;
    const normalizedRight = Number.isFinite(rightTime) ? rightTime : 0;
    return (normalizedLeft - normalizedRight) * sortDirection;
  });

  const paginatedRows = sortedRows.slice(offset, offset + limit);
  const total = sortedRows.length;

  return {
    success: true,
    data: paginatedRows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getDashboardStats = () => {
  const sqlite = ensureDatabase();

  const inventoryRows = sqlite
    .prepare(`
      SELECT *
      FROM inventory
      ORDER BY datetime(updated_at) DESC
    `)
    .all();

  const soldRows = sqlite
    .prepare(`
      SELECT *
      FROM sold_items
      ORDER BY datetime(updated_at) DESC
    `)
    .all();

  const normalizedInventory = inventoryRows.map((row) => {
    const parsed = parseRowData(row) || {};
    const normalizedResult = normalizeInventoryForRead(parsed);

    if (normalizedResult.changed) {
      persistInventoryRecord({
        ...normalizedResult.record,
        updatedAt: nowIso(),
      });
    }

    return normalizedResult.record;
  });

  const sales = soldRows
    .map((row) => parseRowData(row) || {})
    .filter((sale) => !Boolean(sale.cancelled));

  const inventoryById = new Map(
    normalizedInventory.map((item) => [String(item._id || item.id), item])
  );

  const stats = {
    totalInventory: normalizedInventory.length,
    in_stockItems: 0,
    soldItems: 0,
    pendingApproval: 0,
    partiallySoldItems: 0,
    totalValue: 0,
    inStockValue: 0,
    totalWeight: 0,
    totalPieces: 0,
    totalSalesAmount: 0,
  };

  for (const item of normalizedInventory) {
    const status = normalizeInventoryStatus(item.status, "in_stock");

    if (status === "in_stock") {
      stats.in_stockItems += 1;
    } else if (status === "partially_sold") {
      stats.partiallySoldItems += 1;
    } else if (status === "sold") {
      stats.soldItems += 1;
    } else if (status === "pending") {
      stats.pendingApproval += 1;
    }

    if (status !== "sold") {
      const availableWeight = toFloat(item.availableWeight, 0);
      stats.totalWeight += availableWeight;
      stats.totalPieces += toInteger(item.availablePieces, 0);

      const purchaseCode = Number.parseFloat(String(item.purchaseCode || ""));
      if (Number.isFinite(purchaseCode)) {
        stats.totalValue += purchaseCode * availableWeight;
      }

      const saleCode = Number.parseFloat(String(item.saleCode || ""));
      if (Number.isFinite(saleCode)) {
        stats.inStockValue += saleCode * availableWeight;
      }
    }
  }

  const normalizedSales = sales.map((sale) => {
    const amountFromShapes = Array.isArray(sale.soldShapes)
      ? sale.soldShapes.reduce((sum, shape) => sum + toFloat(shape?.lineTotal, toFloat(shape?.weight, 0) * toFloat(shape?.pricePerCarat, 0)), 0)
      : 0;

    const totalAmount = Number(
      toFloat(
        firstDefinedValue(sale.totalAmount, sale.price, sale.salePrice, amountFromShapes),
        amountFromShapes
      ).toFixed(2)
    );

    stats.totalSalesAmount += totalAmount;

    const inventoryId = String(sale.inventoryId || sale.inventory_id || "").trim();
    const linkedInventory = inventoryById.get(inventoryId);
    const soldAt = sale.soldAt || sale.soldDate || sale.createdAt || nowIso();
    const id = String(sale._id || sale.id || "");

    return {
      ...sale,
      _id: id,
      id,
      inventoryId,
      inventoryItem: sale.inventoryItem || linkedInventory || null,
      totalAmount,
      price: totalAmount,
      buyer: sale.customer?.name || sale.buyer || "Walk-in",
      soldAt,
      soldDate: soldAt,
      cancelled: false,
    };
  });

  const recentSales = normalizedSales
    .sort((left, right) => {
      const leftTime = Date.parse(String(left.soldAt || left.soldDate || left.createdAt || ""));
      const rightTime = Date.parse(String(right.soldAt || right.soldDate || right.createdAt || ""));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    })
    .slice(0, 10);

  return {
    totalInventory: stats.totalInventory,
    in_stockItems: stats.in_stockItems,
    soldItems: stats.soldItems,
    pendingApproval: stats.pendingApproval,
    partiallySoldItems: stats.partiallySoldItems,
    totalValue: Number(stats.totalValue.toFixed(2)),
    inStockValue: Number(stats.inStockValue.toFixed(2)),
    totalWeight: Number(stats.totalWeight.toFixed(2)),
    totalPieces: Math.max(0, Number(stats.totalPieces || 0)),
    totalSalesAmount: Number(stats.totalSalesAmount.toFixed(2)),
    recentSales,
  };
};

export const createSoldItem = (payload = {}) => {
  const sqlite = ensureDatabase();
  const inventoryId = String(payload.inventoryId || payload.inventory_id || "").trim();
  const soldShapesInput = Array.isArray(payload.soldShapes) ? payload.soldShapes : [];

  if (!inventoryId || soldShapesInput.length === 0) {
    return {
      success: false,
      message: "Inventory ID and sold shapes are required",
    };
  }

  try {
    const transaction = sqlite.transaction(() => {
      const inventoryRow = sqlite.prepare("SELECT * FROM inventory WHERE id = ?").get(inventoryId);
      if (!inventoryRow) {
        throw new Error("Inventory item not found");
      }

      const normalizedInventoryResult = normalizeInventoryForRead(parseRowData(inventoryRow) || {});
      const inventory = normalizedInventoryResult.record;

      if (normalizedInventoryResult.changed) {
        persistInventoryRecord({
          ...inventory,
          updatedAt: nowIso(),
        });
      }

      if (inventory.status === "sold") {
        throw new Error("This item is already fully sold");
      }

      const normalizedSoldShapes = soldShapesInput
        .map((shape) => normalizeSoldShapeEntry(shape))
        .filter((shape) => shape.pieces > 0 || shape.weight > 0);

      if (normalizedSoldShapes.length === 0) {
        throw new Error("At least one sold shape must include pieces or weight");
      }

      const nextInventory = JSON.parse(JSON.stringify(inventory));

      if (nextInventory.shapeType === "single") {
        let availablePieces = toInteger(nextInventory.availablePieces, toInteger(nextInventory.totalPieces, 0));
        let availableWeight = toFloat(nextInventory.availableWeight, toFloat(nextInventory.totalWeight, 0));

        for (const sold of normalizedSoldShapes) {
          if (sold.pieces > availablePieces) {
            throw new Error(`Only ${availablePieces} pieces available`);
          }
          if (sold.weight > availableWeight) {
            throw new Error(`Only ${availableWeight.toFixed(2)} carats available`);
          }

          availablePieces = Math.max(0, availablePieces - sold.pieces);
          availableWeight = Math.max(0, Number((availableWeight - sold.weight).toFixed(4)));
        }

        nextInventory.availablePieces = clamp(availablePieces, 0, toInteger(nextInventory.totalPieces, 0));
        nextInventory.availableWeight = clamp(availableWeight, 0, toFloat(nextInventory.totalWeight, 0));
      } else {
        const shapeIndexByName = new Map();
        (Array.isArray(nextInventory.shapes) ? nextInventory.shapes : []).forEach((shape, index) => {
          shapeIndexByName.set(String(shape?.shape || "").trim().toLowerCase(), index);
        });

        for (const sold of normalizedSoldShapes) {
          const shapeKey = String(sold.shape || "").trim().toLowerCase();
          if (!shapeKey || !shapeIndexByName.has(shapeKey)) {
            throw new Error(`Shape "${sold.shape || "Unknown"}" not found in inventory`);
          }

          const shapeIndex = shapeIndexByName.get(shapeKey);
          const inventoryShape = nextInventory.shapes[shapeIndex];
          const availablePieces = toInteger(inventoryShape.pieces, 0);
          const availableWeight = toFloat(inventoryShape.weight, 0);

          if (sold.pieces > availablePieces) {
            throw new Error(`Only ${availablePieces} pieces of ${inventoryShape.shape} available`);
          }
          if (sold.weight > availableWeight) {
            throw new Error(`Only ${availableWeight.toFixed(2)} carats of ${inventoryShape.shape} available`);
          }

          inventoryShape.pieces = Math.max(0, availablePieces - sold.pieces);
          inventoryShape.weight = Math.max(0, Number((availableWeight - sold.weight).toFixed(4)));
        }

        nextInventory.availablePieces = nextInventory.shapes.reduce(
          (sum, shape) => sum + Math.max(0, toInteger(shape.pieces, 0)),
          0
        );
        nextInventory.availableWeight = Number(nextInventory.shapes.reduce(
          (sum, shape) => sum + Math.max(0, toFloat(shape.weight, 0)),
          0
        ).toFixed(4));
      }

      nextInventory.status = deriveInventoryStatus({
        requestedStatus: undefined,
        previousStatus: nextInventory.status,
        totalPieces: toInteger(nextInventory.totalPieces, 0),
        totalWeight: toFloat(nextInventory.totalWeight, 0),
        availablePieces: toInteger(nextInventory.availablePieces, 0),
        availableWeight: toFloat(nextInventory.availableWeight, 0),
      });

      nextInventory.totalPrice = computeTotalPrice(nextInventory.saleCode, nextInventory.availableWeight);
      nextInventory.updatedAt = nowIso();
      persistInventoryRecord(nextInventory);

      const id = normalizeId(payload._id || payload.id);
      const createdAt = payload.createdAt || nowIso();
      const soldAt = payload.soldAt || payload.soldDate || createdAt;
      const saleRef = String(payload.saleRef || "").trim() || generateSaleReference();
      const invoiceNumber = String(payload.invoiceNumber || "").trim()
        || `INV-${new Date(soldAt).toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`;

      const totalPieces = normalizedSoldShapes.reduce((sum, shape) => sum + shape.pieces, 0);
      const totalWeight = Number(normalizedSoldShapes
        .reduce((sum, shape) => sum + shape.weight, 0)
        .toFixed(4));
      const totalAmount = Number(normalizedSoldShapes
        .reduce((sum, shape) => sum + toFloat(shape.lineTotal, 0), 0)
        .toFixed(2));

      const record = {
        ...payload,
        id,
        _id: id,
        inventoryId,
        inventoryItem: {
          _id: nextInventory._id,
          serialNumber: nextInventory.serialNumber,
          category: nextInventory.category,
          shapeType: nextInventory.shapeType,
          singleShape: nextInventory.singleShape,
          shapes: nextInventory.shapes,
        },
        soldShapes: normalizedSoldShapes,
        totalPieces,
        totalWeight,
        totalAmount,
        customer: payload.customer || {},
        invoiceNumber,
        saleRef,
        cancelled: false,
        soldAt,
        soldDate: soldAt,
        createdAt,
        updatedAt: createdAt,
      };

      sqlite
        .prepare(`
          INSERT INTO sold_items (id, inventory_id, data, created_at, updated_at)
          VALUES (@id, @inventoryId, @data, @createdAt, @updatedAt)
        `)
        .run({
          id,
          inventoryId,
          data: JSON.stringify(record),
          createdAt,
          updatedAt: createdAt,
        });

      return record;
    });

    const createdSale = transaction();
    return {
      success: true,
      data: createdSale,
      message: `Sale completed successfully. Ref: ${createdSale.saleRef}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to complete sale",
    };
  }
};

export const undoSoldItem = (saleId, reason = "Undone by admin") => {
  const sqlite = ensureDatabase();
  const normalizedId = String(saleId || "").trim();

  if (!normalizedId) {
    return { success: false, message: "Sale id is required" };
  }

  try {
    const transaction = sqlite.transaction(() => {
      const saleRow = sqlite.prepare("SELECT * FROM sold_items WHERE id = ?").get(normalizedId);
      if (!saleRow) {
        throw new Error("Sale not found");
      }

      const sale = parseRowData(saleRow) || {};
      if (sale.cancelled) {
        throw new Error("Sale already cancelled");
      }

      const inventoryId = String(sale.inventoryId || sale.inventory_id || "").trim();
      if (!inventoryId) {
        throw new Error("Inventory reference is missing on sale record");
      }

      const inventoryRow = sqlite.prepare("SELECT * FROM inventory WHERE id = ?").get(inventoryId);
      if (!inventoryRow) {
        throw new Error("Inventory item not found");
      }

      const normalizedInventoryResult = normalizeInventoryForRead(parseRowData(inventoryRow) || {});
      const inventory = normalizedInventoryResult.record;

      const soldShapes = Array.isArray(sale.soldShapes) ? sale.soldShapes.map((shape) => normalizeSoldShapeEntry(shape)) : [];
      if (soldShapes.length === 0) {
        throw new Error("Sale has no shape details to restore");
      }

      const nextInventory = JSON.parse(JSON.stringify(inventory));

      if (nextInventory.shapeType === "single") {
        const restoredPieces = soldShapes.reduce((sum, shape) => sum + shape.pieces, 0);
        const restoredWeight = soldShapes.reduce((sum, shape) => sum + shape.weight, 0);

        nextInventory.availablePieces = clamp(
          toInteger(nextInventory.availablePieces, 0) + restoredPieces,
          0,
          toInteger(nextInventory.totalPieces, 0)
        );
        nextInventory.availableWeight = clamp(
          Number((toFloat(nextInventory.availableWeight, 0) + restoredWeight).toFixed(4)),
          0,
          toFloat(nextInventory.totalWeight, 0)
        );
      } else {
        if (!Array.isArray(nextInventory.shapes)) {
          nextInventory.shapes = [];
        }

        const shapeIndexByName = new Map();
        nextInventory.shapes.forEach((shape, index) => {
          shapeIndexByName.set(String(shape?.shape || "").trim().toLowerCase(), index);
        });

        for (const sold of soldShapes) {
          const shapeKey = String(sold.shape || "").trim().toLowerCase();
          if (!shapeKey) {
            continue;
          }

          if (!shapeIndexByName.has(shapeKey)) {
            nextInventory.shapes.push(normalizeShapeEntry({
              shape: sold.shape,
              pieces: sold.pieces,
              weight: sold.weight,
            }));
            shapeIndexByName.set(shapeKey, nextInventory.shapes.length - 1);
            continue;
          }

          const shapeIndex = shapeIndexByName.get(shapeKey);
          const inventoryShape = nextInventory.shapes[shapeIndex];
          inventoryShape.pieces = Math.max(0, toInteger(inventoryShape.pieces, 0) + sold.pieces);
          inventoryShape.weight = Math.max(0, Number((toFloat(inventoryShape.weight, 0) + sold.weight).toFixed(4)));
        }

        nextInventory.availablePieces = nextInventory.shapes.reduce(
          (sum, shape) => sum + Math.max(0, toInteger(shape.pieces, 0)),
          0
        );
        nextInventory.availableWeight = Number(nextInventory.shapes.reduce(
          (sum, shape) => sum + Math.max(0, toFloat(shape.weight, 0)),
          0
        ).toFixed(4));
      }

      nextInventory.status = deriveInventoryStatus({
        requestedStatus: undefined,
        previousStatus: nextInventory.status,
        totalPieces: toInteger(nextInventory.totalPieces, 0),
        totalWeight: toFloat(nextInventory.totalWeight, 0),
        availablePieces: toInteger(nextInventory.availablePieces, 0),
        availableWeight: toFloat(nextInventory.availableWeight, 0),
      });
      nextInventory.totalPrice = computeTotalPrice(nextInventory.saleCode, nextInventory.availableWeight);
      nextInventory.updatedAt = nowIso();
      persistInventoryRecord(nextInventory);

      const cancelledAt = nowIso();
      const updatedSale = {
        ...sale,
        cancelled: true,
        cancelledAt,
        cancelReason: reason,
        updatedAt: cancelledAt,
      };

      sqlite
        .prepare("UPDATE sold_items SET data = @data, updated_at = @updatedAt WHERE id = @id")
        .run({
          id: normalizedId,
          data: JSON.stringify(updatedSale),
          updatedAt: cancelledAt,
        });

      return {
        saleRef: updatedSale.saleRef,
        inventoryId,
      };
    });

    const result = transaction();
    return {
      success: true,
      message: `Sale ${result.saleRef || normalizedId} successfully undone. Inventory restored.`,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to undo sale",
    };
  }
};

export const getCompanySettings = () => {
  const sqlite = ensureDatabase();
  const row = sqlite.prepare("SELECT data FROM company_settings WHERE id = 1").get();
  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
};

export const saveCompanySettings = (payload = {}) => {
  const sqlite = ensureDatabase();
  sqlite
    .prepare(`
      INSERT INTO company_settings (id, data, updated_at)
      VALUES (1, @data, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `)
    .run({
      data: JSON.stringify(payload),
      updatedAt: nowIso(),
    });

  return { success: true, data: payload };
};

export const backupDatabase = async (destinationPath) => {
  const sqlite = ensureDatabase();
  await sqlite.backup(destinationPath);
  return destinationPath;
};

export const restoreDatabase = (sourcePath) => {
  ensureDatabase();
  if (!databasePath) {
    throw new Error("Database path is not initialized");
  }

  db.close();
  fs.copyFileSync(sourcePath, databasePath);

  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations();

  return databasePath;
};

export const findUserByEmail = (email) => {
  const sqlite = ensureDatabase();
  if (!email) {
    return null;
  }

  return (
    sqlite
      .prepare("SELECT id, name, email, password, role, created_at FROM users WHERE lower(email) = lower(?)")
      .get(String(email).trim()) || null
  );
};

export const findUserById = (id) => {
  const sqlite = ensureDatabase();
  if (id === undefined || id === null || id === "") {
    return null;
  }

  return (
    sqlite
      .prepare("SELECT id, name, email, password, role, created_at FROM users WHERE id = ?")
      .get(id) || null
  );
};

export const getUsersList = (params = {}) => {
  const sqlite = ensureDatabase();
  const search = typeof params.search === "string" ? params.search.trim() : "";

  let rows = [];
  if (search) {
    const like = `%${search}%`;
    rows = sqlite
      .prepare(`
        SELECT id, name, email, role, created_at
        FROM users
        WHERE name LIKE @like OR email LIKE @like OR role LIKE @like
        ORDER BY datetime(created_at) DESC, id DESC
      `)
      .all({ like });
  } else {
    rows = sqlite
      .prepare(`
        SELECT id, name, email, role, created_at
        FROM users
        ORDER BY datetime(created_at) DESC, id DESC
      `)
      .all();
  }

  return {
    success: true,
    data: rows.map(mapUserRow),
  };
};

export const createUserRecord = ({ name, email, passwordHash, role = "staff" }) => {
  const sqlite = ensureDatabase();

  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedRole = normalizeRole(role);

  if (!normalizedName || !normalizedEmail || !passwordHash) {
    return { success: false, message: "Name, email and password are required" };
  }

  try {
    const result = sqlite
      .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run(normalizedName, normalizedEmail, passwordHash, normalizedRole);

    const created = findUserById(result.lastInsertRowid);
    return { success: true, data: mapUserRow(created), raw: created };
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return { success: false, message: "Email already registered" };
    }
    throw error;
  }
};

export const updateUserRoleRecord = (id, role) => {
  const sqlite = ensureDatabase();
  const normalizedRole = normalizeRole(role);
  const result = sqlite
    .prepare("UPDATE users SET role = ? WHERE id = ?")
    .run(normalizedRole, id);

  if (result.changes === 0) {
    return { success: false, message: "User not found" };
  }

  const updated = findUserById(id);
  return { success: true, data: mapUserRow(updated), raw: updated };
};

export const updateUserPasswordRecord = (id, passwordHash) => {
  const sqlite = ensureDatabase();
  const result = sqlite
    .prepare("UPDATE users SET password = ? WHERE id = ?")
    .run(passwordHash, id);

  if (result.changes === 0) {
    return { success: false, message: "User not found" };
  }

  return { success: true };
};

export const updateUserRecord = (id, payload = {}) => {
  const sqlite = ensureDatabase();
  const existing = findUserById(id);

  if (!existing) {
    return { success: false, message: "User not found" };
  }

  const nextName = payload.name !== undefined
    ? String(payload.name || "").trim()
    : existing.name;
  const nextEmail = payload.email !== undefined
    ? String(payload.email || "").trim().toLowerCase()
    : existing.email;
  const nextPassword = payload.passwordHash || existing.password;
  const nextRole = payload.role !== undefined ? normalizeRole(payload.role) : normalizeRole(existing.role);

  if (!nextName || !nextEmail || !nextPassword) {
    return { success: false, message: "Name, email and password are required" };
  }

  try {
    const result = sqlite
      .prepare("UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?")
      .run(nextName, nextEmail, nextPassword, nextRole, id);

    if (result.changes === 0) {
      return { success: false, message: "User not found" };
    }

    const updated = findUserById(id);
    return { success: true, data: mapUserRow(updated), raw: updated };
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return { success: false, message: "Email already registered" };
    }
    throw error;
  }
};

export const deleteUserRecord = (id) => {
  const sqlite = ensureDatabase();
  const result = sqlite.prepare("DELETE FROM users WHERE id = ?").run(id);
  if (result.changes === 0) {
    return { success: false, message: "User not found" };
  }
  return { success: true, data: { id: String(id) } };
};

export const countUsersByRole = (role) => {
  const sqlite = ensureDatabase();
  const row = sqlite
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = ?")
    .get(normalizeRole(role));
  return Number(row?.total || 0);
};
