import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateAuditCsv, type AuditLogItem } from "@/actions/audit-actions";
import { APP_TIMEZONE } from "@/lib/time-utils";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (user.role !== "MANAGER" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (userId) {
      where.OR = [
        { userId },
        { recordId: userId },
      ];
    }

    if (action && action.trim()) {
      where.action = action.trim();
    }

    if (startDateParam || endDateParam) {
      const timestampFilter: Record<string, Date> = {};
      if (startDateParam) {
        timestampFilter.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        timestampFilter.lte = new Date(endDateParam);
      }
      where.timestamp = timestampFilter;
    }

    const rawLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 1000,
    });

    const logs: AuditLogItem[] = rawLogs.map((log) => ({
      id: log.id,
      action: log.action,
      tableName: log.tableName,
      recordId: log.recordId,
      userId: log.userId,
      userName: log.user ? `${log.user.lastName} ${log.user.firstName}`.trim() : "Système",
      userRole: log.user ? log.user.role : null,
      timestamp: log.timestamp,
      payloadOld: log.payloadOld,
      payloadNew: log.payloadNew,
    }));

    const csvContent = generateAuditCsv(logs, APP_TIMEZONE);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const filename = `registre-audit-${todayStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
