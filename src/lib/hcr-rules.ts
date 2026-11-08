/**
 * Moteur de règles HCR
 * Règles légales obligatoires (repos 11h, plafond 48h/semaine, 2 jours de repos)
 */

export const HCR_RULES = {
  MIN_DAILY_REST_HOURS: 11,
  MAX_WEEKLY_HOURS: 48,
  MIN_WEEKLY_REST_DAYS: 2,
  DEFAULT_NOTICE_PERIOD_DAYS: 8,
} as const;

export function checkDailyRest(previousShiftEnd: Date, nextShiftStart: Date): boolean {
  const diffInMs = nextShiftStart.getTime() - previousShiftEnd.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours >= HCR_RULES.MIN_DAILY_REST_HOURS;
}
