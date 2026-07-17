import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement du game auth code Steam (secret) au repos. AES-256-GCM.
 * Clé = 64 hex (32 octets), fournie par l'app via l'env (STEAM_AUTH_ENC_KEY).
 * Format stocké : `iv:tag:ciphertext` (base64).
 */

function keyBuf(keyHex: string): Buffer {
  const buf = Buffer.from(keyHex, "hex");
  if (buf.length !== 32) throw new Error("clé de chiffrement invalide : 32 octets (64 hex) attendus");
  return buf;
}

export function encryptSecret(plain: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf(keyHex), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string, keyHex: string): string {
  const [ivB, tagB, encB] = blob.split(":");
  if (!ivB || !tagB || !encB) throw new Error("blob chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", keyBuf(keyHex), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
}
