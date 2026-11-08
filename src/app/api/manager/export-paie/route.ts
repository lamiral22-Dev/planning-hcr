import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generatePayrollCsv } from "@/lib/export-utils";
import { APP_TIMEZONE } from "@/lib/time-utils";
import { startOfMonth, endOfMonth } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

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
    const now = new Date();

    const month = parseInt(searchParams.get("month") || `${now.getMonth() + 1}`, 10);
    const year = parseInt(searchParams.get("year") || `${now.getFullYear()}`, 10);

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
      return NextResponse.json(
        { error: "Paramètres month (1-12) et year invalides" },
        { status: 400 }
      );
    }

    // Calcul des bornes du mois dans Europe/Paris
    const targetDate = new Date(year, month - 1, 1);
    const startOfTargetMonth = startOfMonth(targetDate);
    const endOfTargetMonth = endOfMonth(targetDate);

    const utcStart = fromZonedTime(startOfTargetMonth, APP_TIMEZONE);
    const utcEnd = fromZonedTime(endOfTargetMonth, APP_TIMEZONE);

    const entries = await prisma.timeEntry.findMany({
      where: {
        clockInTime: {
          gte: utcStart,
          lte: utcEnd,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            matricule: true,
            firstName: true,
            lastName: true,
          },
        },
        shift: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: {
        clockInTime: "asc",
      },
    });

    const csvContent = generatePayrollCsv(entries, APP_TIMEZONE);
    const paddedMonth = month.toString().padStart(2, "0");
    const filename = `export-paie-${paddedMonth}-${year}.csv`;

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
