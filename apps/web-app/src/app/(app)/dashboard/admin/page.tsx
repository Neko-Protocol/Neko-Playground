import type { Metadata } from "next";
import AdminPageClient from "@/features/admin/components/AdminPageClient";

export const metadata: Metadata = {
  title: "Admin | Neko Protocol",
  description:
    "Lending pool administration: pool state, treasury fees, collateral factors, interest rates.",
};

export default function AdminPage() {
  return <AdminPageClient />;
}
