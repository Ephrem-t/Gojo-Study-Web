const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function fillRandomBytes(target) {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(target);
    return target;
  }

  for (let index = 0; index < target.length; index += 1) {
    target[index] = Math.floor(Math.random() * 256);
  }

  return target;
}

function encodeBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(secret) {
  const normalized = String(secret || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      continue;
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

function buildCounterBytes(counter) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const normalizedCounter = Math.max(0, Number(counter) || 0);
  const high = Math.floor(normalizedCounter / 0x100000000);
  const low = normalizedCounter >>> 0;

  view.setUint32(0, high);
  view.setUint32(4, low);
  return buffer;
}

async function generateHotp(secret, counter, digits) {
  const keyBytes = decodeBase32(secret);
  if (!keyBytes.length || !globalThis.crypto || !globalThis.crypto.subtle) {
    return "";
  }

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign("HMAC", cryptoKey, buildCounterBytes(counter)),
  );

  const offset = signature[signature.length - 1] & 15;
  const binary =
    ((signature[offset] & 127) << 24) |
    ((signature[offset + 1] & 255) << 16) |
    ((signature[offset + 2] & 255) << 8) |
    (signature[offset + 3] & 255);

  return String(binary % (10 ** digits)).padStart(digits, "0");
}

export function generateSecret(byteLength = 20) {
  const bytes = new Uint8Array(Math.max(10, Number(byteLength) || 20));
  fillRandomBytes(bytes);
  return encodeBase32(bytes);
}

export async function verify({ secret, token, window = 1, step = 30, digits = 6 } = {}) {
  const normalizedSecret = String(secret || "").trim();
  const normalizedToken = String(token || "").replace(/\s+/g, "");
  const normalizedDigits = Math.max(1, Number(digits) || 6);
  const normalizedWindow = Math.max(0, Number(window) || 0);
  const normalizedStep = Math.max(1, Number(step) || 30);

  if (!normalizedSecret || normalizedToken.length !== normalizedDigits || !/^\d+$/.test(normalizedToken)) {
    return { valid: false };
  }

  const currentCounter = Math.floor(Date.now() / 1000 / normalizedStep);

  for (let offset = -normalizedWindow; offset <= normalizedWindow; offset += 1) {
    const candidate = await generateHotp(normalizedSecret, currentCounter + offset, normalizedDigits);
    if (candidate && candidate === normalizedToken) {
      return { valid: true };
    }
  }

  return { valid: false };
}