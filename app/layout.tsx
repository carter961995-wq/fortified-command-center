import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fortified Work Order Command Center",
  description: "Internal admin dashboard for Fortified Fence & Weld work orders, invoices, costs, and maintenance contracts."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
