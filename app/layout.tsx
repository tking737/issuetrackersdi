import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Issue Tracker",
  description: "Internal issue tracker for employees",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
