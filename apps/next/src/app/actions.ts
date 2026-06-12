"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { requireSessionUserId } from "@/lib/session";

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
