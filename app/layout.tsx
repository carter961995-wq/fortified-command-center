import type { Metadata } from "next";
import { AppShellStyles } from "../components/app-shell-styles";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fortified Work Order Command Center",
  description: "Internal admin dashboard for Fortified Fence & Weld work orders, invoices, costs, and maintenance contracts."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/app-shell.css" />
      </head>
      <body className="app-body">
        <AppShellStyles />
        {children}
      </body>
    </html>
  );
}
