/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Transform a Para hex signature to Miden serialized format.
 * Prefixes with ECDSA auth scheme byte (1) and appends padding byte.
 * Based on: https://github.com/0xMiden/miden-para/blob/main/src/utils.ts#L39-L48
 *
 * Miden ECDSA signature format (66 bytes): r (32) + s (32) + v (1) + padding (1)
 * Para signature format (65 bytes): r (32) + s (32) + v (1)
 * Output format (67 bytes): auth_scheme (1) + r (32) + s (32) + v (1) + padding (1)
 */
export function fromHexSig(hexString: string): Uint8Array {
  const cleanHex = hexString.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const sigBytes = hexToBytes(cleanHex);

  // Para returns 65 bytes: r (32) + s (32) + v (1)
  // Miden expects 66 bytes: r (32) + s (32) + v (1) + padding (1)
  // Output: auth_scheme (1) + Miden sig (66) = 67 bytes total
  const serialized = new Uint8Array(67);
  serialized[0] = 1; // Auth scheme for ECDSA
  serialized.set(sigBytes, 1); // Copy 65 bytes starting at index 1
  serialized[66] = 0; // Padding byte at index 66
  return serialized;
}