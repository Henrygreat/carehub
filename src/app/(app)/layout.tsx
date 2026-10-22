import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  UsersRound,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { auth, signOut } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { brand } from "@/lib/brand";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/monitoring", label: "Monitoring", icon: Eye },
  { href: "/rota", label: "Rota", icon: CalendarRange },
  { href: "/clients", label: "Clients", icon: Heart },
  { href: "/visits", label: "Visits", icon: Calendar },
  { href: "/shifts", label: "Shifts", icon: Clock },
  { href: "/care-plans", label: "Care plans", icon: ClipboardList },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/staff", label: "Staff directory", icon: UsersRound },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/organisation", label: "Organisation", icon: Building2 },
  { href: "/settings/branches", label: "Branches", icon: Building2 },
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
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-[#182F42] px-5 py-6 text-white md:flex">
        <BrandLogo brandColour={membership.organisation.brandColour} />

        {/* Workspace Selector */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Workspace
          </p>
          <p className="mt-1.5 truncate text-sm font-medium">
            {membership.organisation.brandName || membership.organisation.name}
          </p>
        </div>

        {/* Navigation */}
        <Navigation role={membership.role} />

        {/* User Profile */}
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{session.user.email}</p>
          <SignOut />
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        {/* Mobile Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:hidden">
          <BrandLogo brandColour={membership.organisation.brandColour} />
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Menu size={18} />
              Menu
            </summary>
            <div className="absolute right-0 top-12 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="mb-3 border-b border-slate-100 pb-3">
                <p className="text-xs font-medium text-slate-500">
                  {membership.organisation.brandName || membership.organisation.name}
                </p>
              </div>
              <Navigation mobile role={membership.role} />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <SignOut mobile />
              </div>
            </div>
          </details>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function BrandLogo({ brandColour }: { brandColour: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span
        className="grid size-9 place-items-center rounded-xl text-base font-bold text-white shadow-sm"
        style={{ backgroundColor: brandColour }}
      >
        E
      </span>
      <span className="text-[15px] font-semibold tracking-tight">{brand.name}</span>
    </Link>
  );
}

function Navigation({ mobile = false, role }: { mobile?: boolean; role: Role }) {
  const filteredItems = navItems.filter(({ href }) => {
    if (href === "/monitoring") {
      return ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(role);
    }
    if (href === "/rota") return hasPermission(role, "rota:read");
    if (href === "/clients") return hasPermission(role, "clients:read");
    if (href === "/visits") return hasPermission(role, "visits:read");
    if (href === "/shifts") return hasPermission(role, "shifts:read");
    if (href === "/care-plans") return hasPermission(role, "carePlans:read");
    if (href === "/incidents") return hasPermission(role, "incidents:read");
    if (href === "/staff") return hasPermission(role, "staff:read");
    if (href === "/notifications") return hasPermission(role, "notifications:read");
    if (href === "/settings/organisation") {
      return hasPermission(role, "organisation:update");
    }
    if (href === "/settings/branches") {
      return hasPermission(role, "branches:read");
    }
    if (href === "/settings/users") return role === "ORG_ADMIN";
    return true;
  });

  return (
    <nav className={`space-y-0.5 ${mobile ? "mb-0 mt-0" : "mt-6"}`}>
      {filteredItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            mobile
              ? "text-slate-700 hover:bg-slate-50 hover:text-[#237E78]"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
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
      <button
        className={`mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
          mobile
            ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        <LogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}
