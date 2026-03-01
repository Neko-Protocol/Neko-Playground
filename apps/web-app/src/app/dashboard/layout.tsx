import { ReactNode } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* ml matches the sidebar width (220px) so content never goes under it */}
      <main className="ml-[270px] flex min-h-screen flex-1 flex-col items-center text-white">
        {children}
      </main>
    </div>
  );
}
