import AppRoutes from "@/routes/AppRoutes";
import AuthGuard from "@/components/AuthGuard";

export default function App() {
  return (
    <AuthGuard>
      <AppRoutes />
    </AuthGuard>
  );
}
