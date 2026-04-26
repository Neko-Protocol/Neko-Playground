import type { Metadata } from "next";
import "@stellar/design-system/build/styles.min.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Neko Protocol",
  description: "All-in-one platform for RWAs on Stellar",
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
