"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const path = usePathname();
  const isDash = path === "/" || path.startsWith("/fund");
  const isChanges = path.startsWith("/changes");

  const tabCls = (active: boolean) =>
    `text-[15px] border-b-2 px-0.5 py-[19px] transition-colors whitespace-nowrap ${
      active
        ? "font-semibold text-[#211C13] border-[#1F3D63]"
        : "font-medium text-[#8A8170] border-transparent hover:text-[#211C13]"
    }`;

  return (
    <nav className="flex gap-[22px]">
      <Link href="/" className={tabCls(isDash)}>Dashboard</Link>
      <Link href="/changes" className={tabCls(isChanges)}>Changes</Link>
    </nav>
  );
}
