import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Shield,
} from "lucide-react";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";

const navItems = [
  { href: "/platform-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform-admin/applications", label: "Applications", icon: ClipboardList },
  { href: "/platform-admin/organisations", label: "Organisations", icon: Building2 },
  { href: "/platform-admin/invitations", label: "Invitations", icon: Mail },
  { href: "/platform-admin/audit-logs", label: "Audit logs", icon: FileText },
];

export default async function PlatformAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Check if user is a platform admin
  const user = await db.user.findUnique({
    where: { id: session.user.id, disabledAt: null },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });

  if (!user?.isPlatformAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 px-5 py-6 text-white md:flex">
        <Link href="/platform-admin" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-500 text-base font-bold text-slate-900">
            <Shield size={18} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Platform Admin</span>
        </Link>
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Mode
          </p>
          <p className="mt-1 truncate text-sm font-medium">Platform Administration</p>
        </div>
        <nav className="mt-8 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Icon size={18} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-white/10 pt-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Building2 size={18} aria-hidden="true" /> Exit to Organisation
          </Link>
        </div>
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="mt-4 flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:hidden">
          <Link href="/platform-admin" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500 text-base font-bold text-slate-900">
              <Shield size={18} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              Platform Admin
            </span>
          </Link>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg p-2 text-sm font-medium text-slate-700">
              Menu
            </summary>
            <div className="absolute right-0 top-11 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <nav className="space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Icon size={18} aria-hidden="true" /> {label}
                  </Link>
                ))}
              </nav>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="mt-4 flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                  <LogOut size={16} aria-hidden="true" /> Sign out
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
