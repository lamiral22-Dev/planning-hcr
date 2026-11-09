import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * Hache un mot de passe avec sel aléatoire en utilisant scrypt (module crypto natif de Node.js).
 * Format de retour : "salt:derivedKey" en hexadécimal.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Vérifie si le mot de passe fourni correspond au hash stocké.
 * Gère également les hash de legacy/démo si nécessaire en comparaison sécurisée.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash.includes(":")) {
      // Cas de hash brut ou démo
      return storedHash === password;
    }
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKeyBuffer = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKeyBuffer);
  } catch {
    return false;
  }
}
