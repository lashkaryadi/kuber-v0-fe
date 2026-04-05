import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "./contexts/SearchContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Packaging from "@/pages/Packaging";
import PackagingDetails from "@/pages/PackagingDetails";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import InvoicePreview from "@/pages/InvoicePreview";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Categories from "./pages/Categories";
import SoldItems from "./pages/SoldItems";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";
import AuditLogs from "./pages/AuditLogs";
import VerifyEmail from "./pages/VerifyEmail";
import SettingsCompany from "@/pages/SettingsCompany";
import Analytics from "@/pages/Analytics";
import RecycleBin from "@/pages/RecycleBin";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SearchProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute>
                    <Inventory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/categories"
                element={
                  <ProtectedRoute>
                    <Categories />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sold"
                element={
                  <ProtectedRoute>
                    <SoldItems />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Users />
                  </ProtectedRoute>
                }
              />
              {/* Company Settings */}
              <Route
                path="/settings/company"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <SettingsCompany />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              {/* Analytics */}
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recycle-bin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <RecycleBin />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/packaging" element={<Packaging />} />
              <Route path="/packaging/:id" element={<PackagingDetails />} />
              <Route path="/invoice/:soldId" element={<ProtectedRoute><InvoicePreview /></ProtectedRoute>} />
              <Route path="/invoice-preview/:id" element={<ProtectedRoute><InvoicePreview /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SearchProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
