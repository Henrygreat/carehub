import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { notificationReadSchema } from "@/lib/validation";
import { markNotificationsRead, getUnreadCount } from "@/lib/notifications";

const NOTIFICATIONS_PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "notifications:read");

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where = {
      recipientId: context.membership.id,
      ...(unreadOnly && { isRead: false }),
    };

    const [total, unread, data] = await db.$transaction([
      db.notification.count({ where }),
      db.notification.count({
        where: { recipientId: context.membership.id, isRead: false },
      }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: NOTIFICATIONS_PAGE_SIZE,
      }),
    ]);

    return privateJson({
      data,
      pagination: { total, unread, offset, pageSize: NOTIFICATIONS_PAGE_SIZE },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "notifications:read");

    const parsed = notificationReadSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { notificationIds } = parsed.data;

    await markNotificationsRead(context.membership.id, notificationIds);

    const unread = await getUnreadCount(context.membership.id);

    return privateJson({ data: { markedRead: notificationIds.length, unread } });
  } catch (error) {
    return jsonError(error);
  }
}

// Mark all as read
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "notifications:read");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "markAllRead") {
      await db.notification.updateMany({
        where: {
          recipientId: context.membership.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return privateJson({ data: { success: true, unread: 0 } });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
