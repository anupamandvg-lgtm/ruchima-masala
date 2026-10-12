import crypto from "node:crypto";

/**
 * 32-character unambiguous alphabet:
 * Numbers: 2-9 (excludes 0, 1)
 * Letters: A-Z (excludes O, I)
 * Total characters = 32 (5 bits of entropy per character).
 * 5 characters = 32^5 = 33,554,432 unique order IDs.
 *
 * Prevents business volume leakage (German Tank Problem) while staying
 * short, memorable, and clear when read over the phone or WhatsApp.
 */
export const ORDER_ID_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ORDER_ID_CODE_LENGTH = 5;
export const ORDER_ID_PREFIX = "RM-";

/**
 * Generates a non-sequential, obfuscated order ID (e.g. "RM-8M4KP").
 */
export function generateRandomOrderId(): string {
  const bytes = crypto.randomBytes(ORDER_ID_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ORDER_ID_CODE_LENGTH; i++) {
    code += ORDER_ID_CHARSET[bytes[i] % ORDER_ID_CHARSET.length];
  }
  return `${ORDER_ID_PREFIX}${code}`;
}

/**
 * Checks whether a given string is a valid Order ID.
 */
export function isValidOrderId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const pattern = /^RM-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5,6}$/;
  return pattern.test(id);
}
