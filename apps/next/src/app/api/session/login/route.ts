import { NextResponse } from "next/server";
import { DEFAULT_DASHBOARD_USER_ID, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const accessKey = String(formData.get("accessKey") || "").trim();
  const nextPath = String(formData.get("next") || "/dashboard");
  const expectedKey = process.env.DASHBOARD_ACCESS_KEY || process.env.MARKET_API_KEY;

  if (!expectedKey || accessKey !== expectedKey) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "invalid");
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url, 303);
  }

  const redirectUrl = new URL(nextPath.startsWith("/") ? nextPath : "/dashboard", request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(SESSION_COOKIE, process.env.DASHBOARD_USER_ID || DEFAULT_DASHBOARD_USER_ID, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
