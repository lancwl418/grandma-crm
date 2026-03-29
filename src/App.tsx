import { Routes, Route } from "react-router-dom";
import AuthGuard from "@/components/AuthGuard";
import BrowseListings from "@/pages/BrowseListings";

// Lazy import the authenticated routes
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  return (
    <Routes>
      {/* Public: client-facing browse page (no auth) */}
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
