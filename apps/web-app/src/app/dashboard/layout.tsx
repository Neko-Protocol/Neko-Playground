import { ReactNode } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileHeader } from "@/components/navigation/MobileHeader";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileHeader />

      <main className="flex min-h-screen w-full flex-1 flex-col items-center overflow-x-hidden pt-16 text-white lg:ml-[270px] lg:pt-0">
        {children}
      </main>
    </div>
  );
}
