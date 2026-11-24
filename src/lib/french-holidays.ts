export function getFrenchPublicHolidays(year: number): { date: string; name: string }[] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = Date.UTC(year, month - 1, day);
  const mobile = (offset: number) => new Date(easter + offset * 86400000).toISOString().slice(0, 10);
  return [
    { date: `${year}-01-01`, name: "Jour de l'an" },
    { date: mobile(1), name: "Lundi de Pâques" },
    { date: `${year}-05-01`, name: "Fête du Travail" },
    { date: `${year}-05-08`, name: "Victoire 1945" },
    { date: mobile(39), name: "Ascension" },
    { date: mobile(50), name: "Lundi de Pentecôte" },
    { date: `${year}-07-14`, name: "Fête Nationale" },
    { date: `${year}-08-15`, name: "Assomption" },
    { date: `${year}-11-01`, name: "Toussaint" },
    { date: `${year}-11-11`, name: "Armistice" },
    { date: `${year}-12-25`, name: "Noël" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
