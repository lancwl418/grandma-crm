import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import RealEstateCRM from "@/pages/RealEstateCRM";
import Dashboard from "@/pages/Dashboard";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/app" element={<Home />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<RealEstateCRM />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
