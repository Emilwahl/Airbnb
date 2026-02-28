#!/usr/bin/env node
import crypto from "crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs \"your-password\"");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
const payload = `scrypt$${salt}$${hash}`;

console.log("APP_PASSWORD_HASH=\"" + payload + "\"");
