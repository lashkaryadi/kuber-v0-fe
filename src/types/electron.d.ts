export {};

declare global {
  interface Window {
    electronAPI?: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
      auth: {
        signin: (email: string, password: string) => Promise<{
          success: boolean;
          message?: string;
          token?: string;
          accessToken?: string;
          user?: {
            id: string;
            _id?: string;
            name?: string;
            username?: string;
            email: string;
            role: "admin" | "staff";
            createdAt?: string;
          };
        }>;
        signup: (data: {
          name?: string;
          username?: string;
          email: string;
          password: string;
          role?: "admin" | "staff";
        }) => Promise<{
          success: boolean;
          message?: string;
          token?: string;
          accessToken?: string;
          user?: {
            id: string;
            _id?: string;
            name?: string;
            username?: string;
            email: string;
            role: "admin" | "staff";
            createdAt?: string;
          };
        }>;
        verify: (token: string) => Promise<{
          success: boolean;
          message?: string;
          user?: {
            id: string;
            _id?: string;
            name?: string;
            username?: string;
            email: string;
            role: "admin" | "staff";
            createdAt?: string;
          };
        }>;
        signout: () => Promise<{ success: boolean; message?: string }>;
        changePassword: (data: {
          userId: string;
          oldPassword: string;
          newPassword: string;
        }) => Promise<{ success: boolean; message?: string }>;
      };
      users: {
        getAll: (params?: unknown) => Promise<unknown>;
        create: (data: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
        updateRole: (id: string, role: "admin" | "staff") => Promise<unknown>;
        update: (id: string, data: unknown) => Promise<unknown>;
      };
      shapes: {
        getAll: (params?: unknown) => Promise<unknown>;
        create: (data: { name: string }) => Promise<unknown>;
      };
      files: {
        save: (payload: {
          title?: string;
          defaultFileName?: string;
          bytes: number[];
          filters?: Array<{ name: string; extensions: string[] }>;
        }) => Promise<{
          success: boolean;
          cancelled?: boolean;
          message?: string;
          path?: string;
        }>;
      };
      backupData: (filePath?: string) => Promise<{
        success: boolean;
        cancelled?: boolean;
        message?: string;
        path?: string;
      }>;
      restoreData: (filePath?: string) => Promise<{
        success: boolean;
        cancelled?: boolean;
        message?: string;
        path?: string;
      }>;
    };
  }
}
