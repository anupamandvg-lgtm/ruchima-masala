import { AdminAlertsProvider } from "@/lib/admin-alerts-context";
import { AdminGlobalAlertBanner } from "@/components/AdminGlobalAlertBanner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAlertsProvider>
      <AdminGlobalAlertBanner />
      {children}
    </AdminAlertsProvider>
  );
}
