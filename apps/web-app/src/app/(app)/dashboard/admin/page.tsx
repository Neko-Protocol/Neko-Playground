import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLendingAdminAddress } from "@/lib/admin-config";
import AdminGate from "@/features/admin/components/AdminGate";

export const metadata: Metadata = {
  title: "Admin | Neko Protocol",
  description:
    "Lending pool administration: pool state, treasury fees, collateral factors, interest rates.",
};

export default function AdminPage() {
  const adminAddress = getLendingAdminAddress();
  if (!adminAddress) redirect("/dashboard");
  return <AdminGate adminAddress={adminAddress} />;
}
