import crypto from "crypto";

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export function hashPassword(password: string, salt?: string) {
  const saltValue = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, saltValue, KEY_LENGTH);
  return `${HASH_PREFIX}$${saltValue}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [prefix, salt, hashHex] = stored.split("$");
  if (prefix !== HASH_PREFIX || !salt || !hashHex) return false;
  const hash = crypto.scryptSync(password, salt, Buffer.from(hashHex, "hex").length);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

function timingSafeEqualString(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function getStoredPasswordHash() {
  const base64 = process.env.APP_PASSWORD_HASH_B64;
  if (base64) {
    try {
      return Buffer.from(base64, "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  const raw = process.env.APP_PASSWORD_HASH;
  return raw ?? null;
}

export function verifyPasswordFromEnv(password: string) {
  const plain = process.env.APP_PASSWORD_PLAIN;
  if (plain) {
    return timingSafeEqualString(password, plain);
  }

  const stored = getStoredPasswordHash();
  if (!stored) return false;
  return verifyPassword(password, stored);
}
