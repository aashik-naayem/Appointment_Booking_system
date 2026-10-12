/**
 * Unit tests for encryption utilities.
 */

import { describe, it, expect, beforeEach } from "vitest";

// Set a test encryption key before importing the module
beforeEach(() => {
  process.env["ENCRYPTION_KEY"] = "test-encryption-key-32chars-long!!";
});

// Dynamically import after setting env
async function getCrypto() {
  const mod = await import("@/lib/utils/crypto");
  return mod;
}

describe("encrypt / decrypt", () => {
  it("encrypts and decrypts a string correctly", async () => {
    const { encrypt, decrypt } = await getCrypto();
    const original = "my-secret-oauth-token";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await getCrypto();
    const text = "same-input";
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    expect(enc1).not.toBe(enc2);
  });

  it("encrypted value contains colon-separated parts", async () => {
    const { encrypt } = await getCrypto();
    const encrypted = encrypt("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // iv : authTag : ciphertext
    expect(parts[0]?.length).toBe(32); // 16 bytes hex = 32 chars
    expect(parts[1]?.length).toBe(32); // 16 bytes hex = 32 chars
  });

  it("decryption fails with tampered ciphertext", async () => {
    const { encrypt, decrypt } = await getCrypto();
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    // Tamper with ciphertext portion
    const tampered = `${parts[0]}:${parts[1]}:00${parts[2]?.slice(2)}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("handles long strings", async () => {
    const { encrypt, decrypt } = await getCrypto();
    const long = "a".repeat(1000);
    expect(decrypt(encrypt(long))).toBe(long);
  });

  it("handles special characters and unicode", async () => {
    const { encrypt, decrypt } = await getCrypto();
    const special = "token=abc&scope=https://www.googleapis.com/auth/calendar 🔑";
    expect(decrypt(encrypt(special))).toBe(special);
  });
});

describe("ENCRYPTION_KEY validation", () => {
  it("rejects keys shorter than 32 bytes", async () => {
    process.env["ENCRYPTION_KEY"] = "too-short";
    const { encrypt } = await getCrypto();
    expect(() => encrypt("x")).toThrow(/at least 32 bytes/);
  });
});
