/**
 * Universal Date & Time Utilities for CMU Dorm Activity System
 * Accurately parses and formats:
 * - JS Date toString e.g. "Wed Nov 25 2026 20:30:00 GMT+0700 (Indochina Time)"
 * - ISO strings e.g. "2026-11-25T20:30:00.000Z" or "2026-11-25T20:30"
 * - Thai Buddhist Era date formats e.g. "25/11/2569 20:30" or "2569-11-25"
 * - Standard Date objects and timestamps
 */

const THAI_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_MONTH_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const ENG_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

/**
 * Safely parse any date value into a standard JavaScript Date object
 */
export function parseAnyDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Pattern 1: JS Date toString e.g. "Wed Nov 25 2026 20:30:00 GMT+0700..."
  const jsMatch = str.match(/([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (jsMatch) {
    const mStr = jsMatch[1].toLowerCase();
    if (mStr in ENG_MONTHS) {
      let y = parseInt(jsMatch[3], 10);
      if (y > 2400) y -= 543;
      const m = ENG_MONTHS[mStr];
      const d = parseInt(jsMatch[2], 10);
      const hh = parseInt(jsMatch[4], 10);
      const mm = parseInt(jsMatch[5], 10);
      const ss = jsMatch[6] ? parseInt(jsMatch[6], 10) : 0;
      const date = new Date(y, m, d, hh, mm, ss);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Pattern 2: Thai / Slash format e.g. "25/11/2569 20:30" or "25/11/2026"
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10) - 1;
    let y = parseInt(slashMatch[3], 10);
    if (y > 2400) y -= 543;
    const hh = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
    const mm = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    const ss = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;
    const date = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(date.getTime())) return date;
  }

  // Pattern 3: Standard ISO string e.g. "2026-11-25T20:30" or "2026-11-25 20:30"
  const isoMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    if (y > 2400) y -= 543;
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const hh = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const mm = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const ss = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    const date = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(date.getTime())) return date;
  }

  // Pattern 4: Fallback native Date parse
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    if (fallback.getFullYear() > 2400) {
      fallback.setFullYear(fallback.getFullYear() - 543);
    }
    return fallback;
  }

  return null;
}

/**
 * Returns date key formatted as "YYYY-MM-DD" for calendar matching
 */
export function toDateKey(val: any): string {
  const d = parseAnyDate(val);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns time string "HH:mm"
 */
export function toTimeString(val: any): string {
  if (!val) return '';
  const str = String(val).trim();

  // Quick extract if time is already present in string
  const timeMatch = str.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (timeMatch) {
    const hh = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
    const mm = String(parseInt(timeMatch[2], 10)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const d = parseAnyDate(val);
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Returns clean standard datetime string "YYYY-MM-DDTHH:mm" for HTML inputs & API storage
 */
export function normalizeDateTimeString(val: any): string {
  if (!val) return '';
  const d = parseAnyDate(val);
  if (!d) return String(val).trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * Formats time range e.g. "เวลา 20:30 - 23:30 น."
 */
export function formatTimeRange(startVal: any, endVal?: any): string {
  const start = toTimeString(startVal);
  const end = endVal ? toTimeString(endVal) : '';
  if (!start && !end) return '';
  if (start && end && start !== end) {
    return `เวลา ${start} - ${end} น.`;
  }
  if (start) {
    return `เวลา ${start} น.`;
  }
  return '';
}

/**
 * Formats Thai Date with Time e.g. "25 พ.ย. 2569 เวลา 20:30 น."
 */
export function formatThaiDateTime(val: any): string {
  if (!val) return '-';
  const d = parseAnyDate(val);
  if (!d) return String(val);

  const day = d.getDate();
  const month = THAI_MONTH_SHORT[d.getMonth()];
  const year = d.getFullYear() + 543;
  const time = toTimeString(val) || `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return `${day} ${month} ${year} เวลา ${time} น.`;
}

/**
 * Formats Thai Date Only e.g. "25 พฤศจิกายน 2569"
 */
export function formatThaiDateOnly(val: any): string {
  if (!val) return '-';
  const d = parseAnyDate(val);
  if (!d) return String(val);

  const day = d.getDate();
  const month = THAI_MONTH_FULL[d.getMonth()];
  const year = d.getFullYear() + 543;

  return `${day} ${month} ${year}`;
}
