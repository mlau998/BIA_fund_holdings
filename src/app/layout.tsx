import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import AddFundModal from "@/components/AddFundModal";
import SendReportButton from "@/components/SendReportButton";
import NavLinks from "@/components/NavLinks";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,16,400;0,16,500;0,16,600;1,16,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-30 flex items-center gap-[34px] px-8 h-[62px] bg-[rgba(249,246,239,0.85)] backdrop-blur-sm border-b border-[#E4DECF]">
          <Link href="/" className="flex items-center gap-[9px]">
            <div className="w-[26px] h-[26px] rounded-full bg-[#211C13] flex items-center justify-center shrink-0">
              <span className="font-serif italic text-[15px] text-[#E0B24A] leading-none select-none">B</span>
            </div>
            <span className="font-serif text-[19px] font-medium text-[#211C13] leading-none whitespace-nowrap">
              BIA Fund Monitor
            </span>
          </Link>

          <NavLinks />

          <div className="ml-auto flex items-center gap-3">
            <SendReportButton />
            <AddFundModal />
            <span className="font-mono text-[12.5px] text-[#A39A86] pl-1">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-8 pt-[34px] pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
