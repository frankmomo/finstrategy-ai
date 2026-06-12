"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { DEFAULT_DASHBOARD_USER_ID, SESSION_COOKIE, requireSessionUserId } from "@/lib/session";

export async function loginWithAccessKey(formData: FormData) {
  const accessKey = String(formData.get("accessKey") || "").trim();
  const nextPath = String(formData.get("next") || "/dashboard");
  const expectedKey = process.env.DASHBOARD_ACCESS_KEY || process.env.MARKET_API_KEY;

  if (!expectedKey || accessKey !== expectedKey) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  cookies().set(SESSION_COOKIE, process.env.DASHBOARD_USER_ID || DEFAULT_DASHBOARD_USER_ID, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  redirect(nextPath.startsWith("/") ? nextPath : "/dashboard");
}

export async function createPriceAlert(formData: FormData) {
  const userId = await requireSessionUserId();
  const ticker = String(formData.get("ticker") || "").toUpperCase();
  const targetPrice = String(formData.get("targetPrice") || "");
  const triggerCondition = String(formData.get("triggerCondition") || "ABOVE");

  if (!ticker || !targetPrice || !["ABOVE", "BELOW"].includes(triggerCondition)) {
    throw new Error("Invalid alert payload");
  }

  await getPrisma().priceAlert.create({
    data: {
      userId,
      ticker,
      targetPrice,
      triggerCondition: triggerCondition as "ABOVE" | "BELOW"
    }
  });

  revalidatePath("/dashboard");
}
