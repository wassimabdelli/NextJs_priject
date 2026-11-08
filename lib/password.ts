import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hache un mot de passe en clair avec bcryptjs (10 tours de sel).
 * Ne jamais afficher ou loguer le mot de passe en clair.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Vérifie un mot de passe en clair contre un hash bcrypt.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
