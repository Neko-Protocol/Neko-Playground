import type { Metadata } from "next";
import Automation from "@/features/automation/components/pages/Automation";

export const metadata: Metadata = {
  title: "Smart Yield Router | Neko Protocol",
  description:
    "Automated capital allocation across vaults, pools and lending markets.",
};

export default function AutomationPage() {
  return <Automation />;
}
