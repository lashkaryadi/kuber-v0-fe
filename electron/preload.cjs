const { contextBridge, ipcRenderer } = require("electron");

const allowedChannels = new Set([
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
  "dashboard:getStats",
  "images:save",
  "backup:export",
  "backup:restore",
  "files:save",
]);

const invoke = (channel, payload) => {
  if (!allowedChannels.has(channel)) {
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, payload);
};

contextBridge.exposeInMainWorld("electronAPI", {
  invoke,
  auth: {
    signin: (email, password) => invoke("auth:signin", { email, password }),
    signup: (data) => invoke("auth:signup", data),
    verify: (token) => invoke("auth:verify", token),
    signout: () => invoke("auth:signout"),
    changePassword: (data) => invoke("auth:changePassword", data),
  },
  users: {
    getAll: (params) => invoke("users:getAll", params),
    create: (data) => invoke("users:create", data),
    delete: (id) => invoke("users:delete", { id }),
    updateRole: (id, role) => invoke("users:updateRole", { id, role }),
    update: (id, data) => invoke("users:update", { id, data }),
  },
  shapes: {
    getAll: (params) => invoke("shapes:getAll", params),
    create: (data) => invoke("shapes:create", data),
  },
  files: {
    save: (payload) => invoke("files:save", payload),
  },
  backupData: (filePath) => invoke("backup:export", filePath ? { filePath } : undefined),
  restoreData: (filePath) => invoke("backup:restore", filePath ? { filePath } : undefined),
});
