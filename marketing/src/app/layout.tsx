import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Briggs Marketing",
  description: "Marketing dashboard for Briggs — Township",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
