import type { Metadata } from "next";
import Dashboard from "@/features/dashboard/components/pages/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Neko Protocol",
  description: "Overview of your portfolio, pools, and protocol activity.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
