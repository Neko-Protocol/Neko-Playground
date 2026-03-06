import { ReactNode } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileHeader } from "@/components/navigation/MobileHeader";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileHeader />

      {/* On mobile: top padding = navbar (pt-4 + h-14). On desktop: left margin for the sidebar. */}
      <main className="pt-20 lg:pt-0 lg:ml-[270px] flex min-h-screen min-w-0 flex-1 flex-col items-center overflow-x-hidden text-white w-full">
        {children}
      </main>
    </div>
  );
}
