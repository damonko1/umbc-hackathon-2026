import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { Device } from "@prisma/client";
import { getDb } from "@/lib/db";

export const DEVICE_COOKIE_NAME = "realityfork_device";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function createDeviceToken() {
  return randomUUID();
}

export function buildDeviceCookie(token: string) {
  return {
    name: DEVICE_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  };
}

export async function getDeviceTokenFromCookies() {
  const store = await cookies();
  return store.get(DEVICE_COOKIE_NAME)?.value ?? null;
}

export async function resolveOrCreateDevice(deviceToken?: string | null): Promise<Device> {
  const token = deviceToken && deviceToken.length > 0 ? deviceToken : createDeviceToken();
  const db = getDb();

  const existing = await db.device.findUnique({
    where: { deviceToken: token },
  });

  if (existing) {
    return existing;
  }

  return db.device.create({
    data: { deviceToken: token },
  });
}
