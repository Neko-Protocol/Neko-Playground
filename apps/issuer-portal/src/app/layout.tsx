import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Neko Issuers — Launch regulated RWAs on Stellar",
  description:
    "Tokenize real-world assets with built-in compliance (T-REX / SEP-0057) on Stellar testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
