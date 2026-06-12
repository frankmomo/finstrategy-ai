import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "finstrategy_session";

export async function getSessionUserId() {
  const cookieStore = cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || null;
}

export async function requireSessionUserId() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}

export function hasSessionCookie(request: NextRequest) {
  return Boolean(request.cookies.get(SESSION_COOKIE)?.value);
}
