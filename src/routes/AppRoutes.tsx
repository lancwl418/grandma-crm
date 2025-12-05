import { Routes, Route, Navigate } from "react-router-dom";
import RealEstateCRM from "@/pages/RealEstateCRM";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RealEstateCRM />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
