import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LayoutDashboard, LogOut, Settings2, UsersRound } from "lucide-react";
import type { Role } from "@prisma/client";
import { auth, signOut } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/staff", label: "Staff directory", icon: UsersRound },
  { href: "/settings/organisation", label: "Organisation", icon: Building2 },
  { href: "/settings/users", label: "Users & access", icon: Settings2 },
];

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const context = await resolveTenantContext(session);
  const membership = context.membership;

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#102b3a] px-5 py-6 text-white md:flex">
        <Brand brandColour={membership.organisation.brandColour} />
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Workspace</p>
          <p className="mt-1 truncate text-sm font-medium">
            {membership.organisation.brandName || membership.organisation.name}
          </p>
        </div>
        <Navigation role={membership.role} />
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{session.user.email}</p>
          <SignOut />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:hidden">
          <Brand brandColour={membership.organisation.brandColour} />
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg p-2 text-sm font-medium text-slate-700">Menu</summary>
            <div className="absolute right-0 top-11 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <Navigation mobile role={membership.role} />
              <SignOut mobile />
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}

function Brand({ brandColour }: { brandColour: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl text-base font-bold text-white" style={{ backgroundColor: brandColour }}>F</span>
      <span className="text-[15px] font-semibold tracking-tight">FalconCare Hub</span>
    </Link>
  );
}

function Navigation({ mobile = false, role }: { mobile?: boolean; role: Role }) {
  return (
    <nav className={`space-y-1 ${mobile ? "mb-2 mt-0" : "mt-8"}`}>
      {navItems
        .filter(({ href }) => {
          if (href === "/staff") return hasPermission(role, "staff:read");
          if (href === "/settings/organisation") {
            return hasPermission(role, "organisation:update");
          }
          if (href === "/settings/users") return role === "ORG_ADMIN";
          return true;
        })
        .map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
            mobile ? "text-slate-700 hover:bg-slate-50" : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon size={18} aria-hidden="true" /> {label}
        </Link>
        ))}
    </nav>
  );
}

function SignOut({ mobile = false }: { mobile?: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button className={`mt-4 flex items-center gap-2 text-sm transition ${mobile ? "text-slate-700 hover:text-slate-900" : "text-slate-300 hover:text-white"}`}>
        <LogOut size={16} aria-hidden="true" /> Sign out
      </button>
    </form>
  );
}
