import DashboardHome from "@/components/dashboard-home";
import { loadDashboardSummary } from "@/lib/dashboard-summary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboardData = await loadDashboardSummary();
  return <DashboardHome initialData={dashboardData} />;
}
