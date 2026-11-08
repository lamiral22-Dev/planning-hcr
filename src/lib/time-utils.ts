import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = "Europe/Paris";

export function toAppTime(date: Date): Date {
  return toZonedTime(date, APP_TIMEZONE);
}

export function fromAppTime(date: Date): Date {
  return fromZonedTime(date, APP_TIMEZONE);
}
