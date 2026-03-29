import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import RealEstateCRM from "@/pages/RealEstateCRM";
import Dashboard from "@/pages/Dashboard";
import AssistantDashboard from "@/pages/AssistantDashboard";
import ProfilePage from "@/pages/ProfilePage";
import VisitorsPage from "@/pages/VisitorsPage";
import AgentSearchPage from "@/pages/AgentSearchPage";
import MarketingPage from "@/pages/MarketingPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/app" element={<Home />}>
        <Route index element={<ProfilePage />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<RealEstateCRM />} />
        <Route path="visitors" element={<VisitorsPage />} />
        <Route path="search" element={<AgentSearchPage />} />
        <Route path="assistant" element={<AssistantDashboard />} />
        <Route path="marketing" element={<MarketingPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
