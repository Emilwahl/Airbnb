import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "rt_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function base64UrlEncode(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const padded = input + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error("APP_SESSION_SECRET is not set");
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(data).digest());
}

export function createSessionToken() {
  const now = Date.now();
  const payload = {
    iat: now,
    exp: now + SESSION_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const data = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function validateSessionToken(token?: string | null) {
  if (!token) return false;
  const [data, signature] = token.split(".");
  if (!data || !signature) return false;
  const expected = sign(data);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(data).toString("utf8")) as {
      exp: number;
    };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function readSessionCookie() {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  const token = match ? match.split("=")[1] : null;
  return validateSessionToken(token);
}
