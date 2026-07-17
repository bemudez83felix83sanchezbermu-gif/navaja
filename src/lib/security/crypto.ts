import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Cifrado simétrico para tokens de terceros en reposo (Mercado Pago OAuth por
 * barbería). Los tokens JAMÁS deben llegar al navegador ni a logs — el filtro
 * más fuerte es `PAYMENTS_ENCRYPTION_KEY` viviendo solo en el env del servidor
 * (validado por [[validation.ts]]).
 *
 * Formato: AES-256-GCM con IV único por operación. La salida es un solo string
 * base64 con `iv (12B) | authTag (16B) | ciphertext`, para no arrastrar tres
 * columnas por token. Reversible solo con la misma llave.
 */

const ALG = "aes-256-gcm";
const IV_LEN = 12;   // GCM recomendado
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = env.PAYMENTS_ENCRYPTION_KEY;
  if (!hex) {
    // Sin llave no hay nada que hacer — mejor romper el flujo del OAuth que
    // guardar tokens en claro o con una llave por defecto.
    throw new Error(
      "PAYMENTS_ENCRYPTION_KEY no está configurada. Genera una con " +
        "'openssl rand -hex 32' y ponla en .env.local.",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("Token cifrado inválido");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
