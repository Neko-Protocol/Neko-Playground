import { ReactNode } from "react";
import { Layout } from "@stellar/design-system";
import { Navbar } from "@/components/navigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="text-[#081F5C] min-h-screen">
      <Navbar />
      {children}
      <Layout.Footer>
        <span className="text-[#334EAC]">
          © {new Date().getFullYear()} Neko Protocol. Licensed under the{" "}
          <a
            href="https://opensource.org/license/mit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0325cb] font-bold"
          >
            MIT License
          </a>
          .
        </span>
      </Layout.Footer>
    </main>
  );
}
