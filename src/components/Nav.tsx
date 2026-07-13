import Link from "next/link";
import { getCurrentProfile } from "@/lib/get-profile";
import { signOut } from "@/lib/auth-actions";

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
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-bold text-green-800">
          Buddy Cup
        </Link>
        <nav className="flex items-center gap-4 overflow-x-auto text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-neutral-700 hover:text-green-800">
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="whitespace-nowrap text-neutral-500 hover:text-red-700">
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
