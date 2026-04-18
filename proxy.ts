import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEVICE_COOKIE_NAME = "realityfork_device";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function createDeviceToken() {
  return crypto.randomUUID();
}

export function proxy(req: NextRequest) {
  const existing = req.cookies.get(DEVICE_COOKIE_NAME)?.value;

  if (existing) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: createDeviceToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
