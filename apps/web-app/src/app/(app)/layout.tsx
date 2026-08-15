import { ReactNode } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { WalletAutoConnect } from "@/components/WalletAutoConnect";
import { WalletCookieSync } from "@/components/WalletCookieSync";
import { RiskAlertProvider } from "@/features/borrowing/context/RiskAlertContext";
import { getLendingAdminAddress } from "@/lib/admin-config";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const lendingAdminAddress = getLendingAdminAddress();

  return (
    <RiskAlertProvider>
      <div className="flex min-h-screen">
        <WalletAutoConnect />
        <WalletCookieSync />
        <Sidebar lendingAdminAddress={lendingAdminAddress} />
        <MobileHeader lendingAdminAddress={lendingAdminAddress} />

        {}
        <main
          className="pt-16 lg:pt-0 lg:ml-[270px] flex min-h-screen min-w-0 flex-1 flex-col items-center overflow-x-hidden text-white w-full"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>
      </div>
    </RiskAlertProvider>
  );
}
