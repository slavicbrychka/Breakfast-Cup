import Link from "next/link";
import { getCurrentProfile } from "@/lib/get-profile";
import { signOut } from "@/lib/auth-actions";
import NavLinks from "./NavLinks";

const PLAYER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rounds", label: "Qualifying" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/trophy-case", label: "Trophy Case" },
];

export default async function Nav() {
  const profile = await getCurrentProfile();

  if (!profile) return null;

  const links = profile.role === "admin" ? [...PLAYER_LINKS, { href: "/admin", label: "Admin" }] : PLAYER_LINKS;

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-bold text-green-800 dark:text-green-400">
          The Breakfast Cup
        </Link>
        <nav className="flex items-center gap-2 overflow-x-auto text-sm">
          <NavLinks links={links} />
          <form action={signOut} className="ml-1">
            <button
              type="submit"
              className="whitespace-nowrap px-2 py-1 text-neutral-500 hover:text-red-700 dark:text-neutral-400 dark:hover:text-red-400"
            >
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
