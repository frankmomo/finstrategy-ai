import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinStrategy Engine",
  description: "Low-latency market analytics, options intelligence, and AI strategy analysis."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-terminal-bg font-mono text-terminal-text antialiased">
        {children}
      </body>
    </html>
  );
}
