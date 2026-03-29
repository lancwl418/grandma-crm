import { Routes, Route } from "react-router-dom";
import AuthGuard from "@/components/AuthGuard";
import BrowseListings from "@/pages/BrowseListings";
import BrowseRegister from "@/pages/BrowseRegister";
import ClientLogin from "@/pages/ClientLogin";

// Lazy import the authenticated routes
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  return (
    <Routes>
      {/* Public: client-facing pages (no auth) */}
      <Route path="/browse/new/:agentId" element={<BrowseRegister />} />
      <Route path="/browse/login" element={<ClientLogin />} />
      <Route path="/browse/:clientId" element={<BrowseListings />} />

      {/* Protected: all other routes */}
      <Route
        path="*"
        element={
          <AuthGuard>
            <AppRoutes />
          </AuthGuard>
        }
      />
    </Routes>
  );
}
