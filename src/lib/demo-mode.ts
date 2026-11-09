/**
 * Vérifie si le mode démonstration / environnement de test est activé.
 * Par défaut en production, ENABLE_DEMO_MODE est absent ou "false", ce qui désactive le mode démo.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.ENABLE_DEMO_MODE === "true";
}
