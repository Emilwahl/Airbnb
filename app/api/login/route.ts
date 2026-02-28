import { NextResponse } from "next/server";
import { getStoredPasswordHash, verifyPasswordFromEnv } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const formData = await req.formData();
  const password = String(formData.get("password") ?? "");
  const storedHash = getStoredPasswordHash();
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : new URL(req.url).origin;

  if (!storedHash && !process.env.APP_PASSWORD_PLAIN) {
    return NextResponse.json(
      { error: "Password configuration is missing" },
      { status: 500 }
    );
  }

  if (!verifyPasswordFromEnv(password)) {
    return NextResponse.redirect(new URL("/login?error=1", baseUrl));
  }

  const token = createSessionToken();
  const response = NextResponse.redirect(new URL("/", baseUrl));
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
