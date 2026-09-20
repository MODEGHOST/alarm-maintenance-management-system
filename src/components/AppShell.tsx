import Link from "next/link";
import { logout } from "@/app/actions/auth";
import type { Profile } from "@/lib/types";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/machines", label: "Machines" },
  { href: "/alarms", label: "Alarms" },
  { href: "/maintenance", label: "Maintenance" },
];

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-500">
              Automation Systems
            </p>
            <h1 className="text-lg font-bold text-slate-900">
              Alarm & Maintenance
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
              {profile.full_name || profile.email} · {profile.role}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-700"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
