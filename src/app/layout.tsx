import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BIA Fund Holdings Monitor",
  description: "Internal platform for monitoring BIA portfolio holdings across GRNY, IVES, MPLY, TCI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-bold text-blue-700 tracking-tight">
                BIA Fund Monitor
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  href="/"
                  className="text-gray-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/changes"
                  className="text-gray-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Changes
                </Link>
              </nav>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
