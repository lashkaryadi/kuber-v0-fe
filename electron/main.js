import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
import isDev from "electron-is-dev";
import { initializeDatabase } from "./db.js";
import { registerIpcHandlers } from "./ipcHandlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

const resolveAppIcon = () => {
  const candidates = [
    path.join(__dirname, "assets", "icon.png"),
    path.join(__dirname, "..", "public", "icon.png"),
    path.join(__dirname, "..", "public", "placeholder.svg"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const createWindow = async () => {
  const iconPath = resolveAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: "Kuber",
    icon: iconPath,
    webPreferences: {
      // Use explicit CommonJS preload to avoid ESM/CJS ambiguity in Electron preload execution.
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[electron] Preload error:", preloadPath, error);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error("[electron] Renderer failed to load:", code, description, url);
  });

  mainWindow.webContents.on("dom-ready", async () => {
    try {
      const hasBridge = await mainWindow.webContents.executeJavaScript("Boolean(window.electronAPI)");
      console.log("[electron] Bridge available:", hasBridge);
    } catch (error) {
      console.error("[electron] Failed to verify bridge availability:", error);
    }
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.setName("Kuber");

app.whenReady().then(async () => {
  initializeDatabase(app.getPath("userData"));
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
