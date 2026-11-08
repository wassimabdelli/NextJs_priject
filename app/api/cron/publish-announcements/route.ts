import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { publishDueAnnouncements } from "@/lib/announcements/publication";

function isValidCronSecret(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expectedSecret || !authorization || !authorization.startsWith("Bearer ")) {
    return false;
  }

  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(authorization.slice(7));

  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const publishedCount = await publishDueAnnouncements(null);
    return NextResponse.json({
      success: true,
      message: "Scheduled announcements processed",
      publishedCount,
    });
  } catch {
    console.error("[cron] Announcement publication failed");
    return NextResponse.json(
      { error: "Announcement publication failed" },
      { status: 500 }
    );
  }
}
