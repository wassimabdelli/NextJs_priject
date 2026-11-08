import { NextRequest } from "next/server";
import { POST as publishAnnouncements } from "../publish-announcements/route";

export async function GET(request: NextRequest) {
  const postRequest = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
  });
  return publishAnnouncements(postRequest);
}
