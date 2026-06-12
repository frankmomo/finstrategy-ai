import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinStrategy Engine",
  description: "Analisis de mercado, inteligencia de opciones y evaluacion de estrategias con IA."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-terminal-bg font-mono text-terminal-text antialiased">
        {children}
      </body>
    </html>
  );
}
