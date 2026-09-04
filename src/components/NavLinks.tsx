"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "whitespace-nowrap rounded-md bg-green-100 px-2 py-1 font-medium text-green-800 dark:bg-green-900 dark:text-green-300"
                : "whitespace-nowrap px-2 py-1 text-neutral-700 hover:text-green-800 dark:text-neutral-300 dark:hover:text-green-400"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
