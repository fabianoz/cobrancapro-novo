/**
 * Business Hours Utility
 *
 * Checks whether the current time falls within Brazilian business hours:
 *   - Monday to Friday (no Saturdays/Sundays)
 *   - 09:00 to 18:00 (configurable via settings or env)
 *   - No Brazilian national holidays (fixed + movable)
 *
 * All times are in America/Sao_Paulo timezone.
 */

// Fixed-date national holidays (month/day, 1-indexed month)
const FIXED_HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: 'Confraternizacao Universal' },
  { month: 4, day: 21, name: 'Tiradentes' },
  { month: 5, day: 1, name: 'Dia do Trabalho' },
  { month: 9, day: 7, name: 'Independencia do Brasil' },
  { month: 10, day: 12, name: 'Nossa Senhora Aparecida' },
  { month: 11, day: 2, name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamacao da Republica' },
  { month: 12, day: 25, name: 'Natal' },
];

/**
 * Calculate Easter Sunday for a given year using the Gauss/Meeus algorithm.
 * Returns [month, day] (1-indexed month).
 */
function easterSunday(year: number): [number, number] {
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
  return [month, day];
}

/**
 * Get all Brazilian national holidays for a given year (fixed + movable).
 * Movable holidays derived from Easter:
 *   - Carnaval: 47 days before Easter (Tuesday)
 *   - Sexta-feira Santa: 2 days before Easter
 *   - Corpus Christi: 60 days after Easter
 */
function getHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  for (const h of FIXED_HOLIDAYS) {
    const key = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
    holidays.set(key, h.name);
  }

  const [easterMonth, easterDay] = easterSunday(year);
  const easter = new Date(Date.UTC(year, easterMonth - 1, easterDay));

  // Carnaval (47 days before Easter)
  const carnaval = new Date(easter);
  carnaval.setUTCDate(carnaval.getUTCDate() - 47);
  holidays.set(formatDateKey(carnaval), 'Carnaval');

  // Sexta-feira Santa (2 days before Easter)
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidays.set(formatDateKey(goodFriday), 'Sexta-feira Santa');

  // Corpus Christi (60 days after Easter)
  const corpusChristi = new Date(easter);
  corpusChristi.setUTCDate(corpusChristi.getUTCDate() + 60);
  holidays.set(formatDateKey(corpusChristi), 'Corpus Christi');

  return holidays;
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the current time in America/Sao_Paulo timezone.
 * Returns a Date object whose UTC fields represent Sao Paulo local time.
 */
function getSaoPauloNow(): Date {
  const now = new Date();
  // Convert to Sao Paulo time using Intl API
  const saoPauloStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(saoPauloStr);
}

export type BusinessHoursConfig = {
  startHour: number; // 0-23
  endHour: number;   // 0-23
  enabled: boolean;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  startHour: 9,
  endHour: 18,
  enabled: true,
};

/**
 * Check if the current moment is within business hours.
 * Business hours = Mon-Fri, startHour-endHour (exclusive), no national holidays.
 */
export function isBusinessHours(config?: BusinessHoursConfig): boolean {
  const cfg = config || DEFAULT_BUSINESS_HOURS;

  if (!cfg.enabled) return true;

  const now = getSaoPauloNow();
  const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday

  // No weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check holidays
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;
  const holidays = getHolidays(year);
  if (holidays.has(dateKey)) {
    return false;
  }

  // Check hour range
  const hour = now.getHours();
  if (hour < cfg.startHour || hour >= cfg.endHour) {
    return false;
  }

  return true;
}

/**
 * Check if today is a holiday or weekend (regardless of hour).
 */
export function isNonBusinessDay(): boolean {
  const now = getSaoPauloNow();
  const dayOfWeek = now.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;
  const holidays = getHolidays(year);
  return holidays.has(dateKey);
}

/**
 * Get a human-readable reason why we're outside business hours.
 */
export function getOutsideBusinessHoursReason(config?: BusinessHoursConfig): string {
  const cfg = config || DEFAULT_BUSINESS_HOURS;
  const now = getSaoPauloNow();
  const dayOfWeek = now.getDay();
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return `Final de semana (${dayNames[dayOfWeek]}). Mensagens serao enviadas no proximo dia util a partir das ${cfg.startHour}h.`;
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;
  const holidays = getHolidays(year);

  if (holidays.has(dateKey)) {
    return `Feriado nacional (${holidays.get(dateKey)}). Mensagens serao enviadas no proximo dia util a partir das ${cfg.startHour}h.`;
  }

  const hour = now.getHours();
  if (hour < cfg.startHour) {
    return `Antes do horario comercial (${hour}h). Mensagens serao enviadas a partir das ${cfg.startHour}h.`;
  }
  return `Apos horario comercial (${hour}h). Mensagens serao enviadas no proximo dia util a partir das ${cfg.startHour}h.`;
}
