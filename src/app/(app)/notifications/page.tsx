import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { NotificationsList } from "@/components/notifications-list";

export const metadata = {
  title: "Notifications | FalconCare Hub",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const context = await resolveTenantContext(session);
  const membership = context.membership;

  if (!hasPermission(membership.role, "notifications:read")) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Activity</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Notifications</h1>
        <p className="mt-2 text-sm text-slate-500">
          Stay updated with assignments, schedule changes, and important alerts.
        </p>
      </div>

      <NotificationsList />
    </div>
  );
}
