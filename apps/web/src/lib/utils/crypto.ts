/**
 * Encryption utilities for storing OAuth tokens securely.
 * Uses AES-256-GCM via Node.js crypto.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const key = process.env["ENCRYPTION_KEY"];
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set");

  // Ensure key is exactly 32 bytes
  const keyBuffer = Buffer.from(key, "utf-8");
  if (keyBuffer.length < KEY_LENGTH) {
    return Buffer.concat([keyBuffer, Buffer.alloc(KEY_LENGTH - keyBuffer.length)]);
  }
  return keyBuffer.slice(0, KEY_LENGTH);
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}
