import { BadgerSettings } from "./BadgerSettings";

/** Strict ISO date-only matcher for holiday keys — rejects national formats and datetimes. */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Shared empty holiday set — the "weekends only" default, never mutated. */
const EMPTY_HOLIDAYS: ReadonlySet<string> = new Set<string>();

/**
 * Upper bound on calendar-day steps taken per requested business day before the
 * business-day walkers give up. Real holiday calendars never block more than a
 * few consecutive days; a value this large only ever trips on a pathological set
 * (e.g. every day marked a holiday), turning a would-be infinite loop into a throw.
 */
const MAX_STEPS_PER_BUSINESS_DAY = 1000;

/** Local-component `YYYY-MM-DD` key for a raw Date (matches Badger#localDateKey). */
function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type UnitOfTime =
  | "year"
  | "quarter"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond";

type DurationObject = {
  years?: number;
  year?: number;
  months?: number;
  month?: number;
  weeks?: number;
  week?: number;
  days?: number;
  day?: number;
  hours?: number;
  hour?: number;
  minutes?: number;
  minute?: number;
  seconds?: number;
  second?: number;
  milliseconds?: number;
  millisecond?: number;
};

/** Returns the ISO 8601 week number (1–53) for a given Date. */
function isoWeekNumber(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const jan4 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - jan4.getTime()) / 86400000 -
        3 +
        ((jan4.getDay() + 6) % 7)) /
        7,
    )
  );
}

/** Returns the ISO week-year for a given Date (may differ from calendar year at year boundaries). */
function isoWeekYear(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  return date.getFullYear();
}

/**
 * Lightweight immutable-style date wrapper for arithmetic, comparison, and boundary operations.
 *
 * String inputs are treated as UTC. Date-only strings (`"YYYY-MM-DD"`) are parsed as
 * UTC midnight per the ECMAScript spec — no suffix is appended. Datetime strings without a
 * timezone indicator (e.g. `"2026-03-15T10:30:00"`) get `"Z"` appended automatically.
 * Getters use local time methods.
 *
 * @example
 * ```ts
 * const dt = new Badger("2026-03-15T10:30:00");
 * dt.add(7, "day").isBefore(dt);              // false
 * dt.add(backendDiff, "millisecond");         // adjust for server clock skew
 * dt.startOf("month");                        // 2026-03-01T00:00:00
 * dt.diff(other, "hour");                     // 5
 * dt.diff(other, "millisecond");              // exact ms delta
 * ```
 */
export class Badger {
  private currentDate: Date;

  /**
   * @param dateTime - A date string (UTC), `Date` object, or omit for current time.
   *
   * String inputs are treated as UTC:
   * - Date-only strings (`"YYYY-MM-DD"`) are left as-is — the ECMAScript spec already
   *   parses them as UTC midnight, and appending `"Z"` produces an invalid string in Safari.
   * - Strings with an explicit timezone indicator (`Z` or `+HH:MM`/`-HH:MM`) are used as-is.
   * - All other bare datetime strings (e.g. `"2026-03-15T10:30:00"`) get `"Z"` appended.
   */
  constructor(dateTime?: string | Date) {
    if (dateTime instanceof Date) {
      this.currentDate = new Date(dateTime.getTime());
    } else if (typeof dateTime === "string") {
      if (dateTime === "") {
        // Empty string is falsy but is still an invalid date input — produce Invalid Date
        // so isValid() returns false rather than silently falling back to current time.
        this.currentDate = new Date(NaN);
      } else {
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateTime);
        const hasTimezoneIndicator = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateTime);
        this.currentDate = new Date(
          isDateOnly || hasTimezoneIndicator ? dateTime : dateTime + "Z",
        );
      }
    } else {
      this.currentDate = new Date(Date.now());
    }
  }

  /**
   * Returns the earliest of the provided `Badger` instances.
   *
   * @example
   * ```ts
   * const earliest = Badger.min(deadline, today, cutoff); // whichever comes first
   * ```
   */
  static min(...dates: Badger[]): Badger {
    if (dates.length === 0) throw new RangeError("Badger.min() requires at least one date");
    const invalid = dates.find(d => !d.isValid());
    if (invalid) throw new RangeError("Badger.min(): all dates must be valid — use isValid() to filter first");
    return dates.reduce((a, b) => (a.isBefore(b) ? a : b));
  }

  /**
   * Returns the latest of the provided `Badger` instances.
   *
   * @example
   * ```ts
   * const latest = Badger.max(deadline, today, cutoff); // whichever comes last
   * ```
   */
  static max(...dates: Badger[]): Badger {
    if (dates.length === 0) throw new RangeError("Badger.max() requires at least one date");
    const invalid = dates.find(d => !d.isValid());
    if (invalid) throw new RangeError("Badger.max(): all dates must be valid — use isValid() to filter first");
    return dates.reduce((a, b) => (a.isAfter(b) ? a : b));
  }

  /**
   * Creates a `Badger` from a local date string and time string, avoiding UTC conversion.
   *
   * The standard constructor appends `Z` to bare strings, treating them as UTC and shifting
   * the local time by the UTC offset. Use this factory when you have an explicit
   * `"YYYY-MM-DD"` + `"HH:mm"` pair that represents local wall-clock time — for example,
   * a user-selected pickup date and time.
   *
   * @param date - ISO date string `"YYYY-MM-DD"`
   * @param time - Time string `"HH:mm"`
   * @returns `Badger` representing the given local date and time.
   *
   * @example
   * ```ts
   * const dt = Badger.fromLocal("2026-05-22", "00:15");
   * dt.hour;      // 0  (local midnight — not shifted to UTC)
   * dt.dayOfWeek; // 5  (Friday, correct local day of week)
   * ```
   */
  static fromLocal(date: string, time: string): Badger {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new RangeError(`fromLocal: date must be "YYYY-MM-DD", got "${date}"`);
    if (!/^\d{2}:\d{2}$/.test(time))
      throw new RangeError(`fromLocal: time must be "HH:mm", got "${time}"`);
    const [year, month, day] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    if (month! < 1 || month! > 12) throw new RangeError(`fromLocal: month must be 1–12, got ${month}`);
    if (day! < 1 || day! > 31)    throw new RangeError(`fromLocal: day must be 1–31, got ${day}`);
    if (h! > 23)                   throw new RangeError(`fromLocal: hour must be 0–23, got ${h}`);
    if (m! > 59)                   throw new RangeError(`fromLocal: minute must be 0–59, got ${m}`);
    const result = new Badger(new Date(year!, month! - 1, day!, h!, m!, 0, 0));
    // Post-construction overflow check: catches e.g. Feb 31 overflowing into March.
    if (result.month !== month! || result.day !== day!) {
      throw new RangeError(`fromLocal: day ${day} is out of range for month ${month} in year ${year}`);
    }
    return result;
  }

  /**
   * Returns an array of `Badger` instances from `start` (inclusive) to `end` (exclusive),
   * stepping by the given unit (`"day"`, `"week"`, or `"month"`).
   *
   * @example
   * ```ts
   * Badger.range("2026-06-01", "2026-06-08", "day")
   * // → [Jun 1, Jun 2, Jun 3, Jun 4, Jun 5, Jun 6, Jun 7]
   *
   * Badger.range(start, end, "week") // one entry per week
   * Badger.range(start, end, "month") // one entry per month
   * ```
   */
  static range(
    start: string | Date | Badger,
    end: string | Date | Badger,
    unit: "day" | "week" | "month"
  ): Badger[] {
    const normalise = (d: Badger) => unit === "day" ? d.startOf("day") : d;
    const s = normalise(start instanceof Badger ? start : new Badger(start));
    const e = normalise(end instanceof Badger ? end : new Badger(end));
    if (!s.isValid()) throw new RangeError("Badger.range: start is not a valid date");
    if (!e.isValid()) throw new RangeError("Badger.range: end is not a valid date");
    const results: Badger[] = [];
    let current = s;
    while (current.isBefore(e)) {
      results.push(current);
      current = normalise(current.add(1, unit));
    }
    return results;
  }

  /** Returns `true` if the date is valid. */
  isValid(): boolean {
    return !isNaN(this.currentDate.getTime());
  }

  // --- Getters ---

  /** Returns a copy of the internal `Date` object. */
  toDate(): Date {
    return new Date(this.currentDate.getTime());
  }

  /**
   * Returns the ISO 8601 string representation.
   * @throws {RangeError} if the date is not valid — call `isValid()` first.
   */
  toISOString(): string {
    if (!this.isValid()) throw new RangeError("Badger.toISOString(): date is not valid — call isValid() first");
    return this.currentDate.toISOString();
  }

  /** Returns the Unix timestamp in seconds (floored). */
  toUnixTimestamp(): number {
    return Math.floor(this.currentDate.getTime() / 1000);
  }

  /** Returns the Unix timestamp in milliseconds. */
  toMillisecondTimestamp(): number {
    return this.currentDate.getTime();
  }

  /**
   * Returns a plain object with all date fields.
   * Month is 1-indexed (1 = January).
   *
   * @example
   * ```ts
   * new Badger("2026-07-04T15:30:45.123Z").toObject()
   * // { year: 2026, month: 7, day: 4, hour: 15, minute: 30, second: 45, millisecond: 123 }
   * ```
   */
  toObject(): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  } {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      second: this.second,
      millisecond: this.millisecond,
    };
  }

  /** Creates an independent copy of this instance. */
  clone(): Badger {
    return new Badger(this.currentDate);
  }

  /** Full year (e.g. `2026`). */
  get year(): number {
    return this.currentDate.getFullYear();
  }

  /** 1-indexed month (1 = January, 12 = December). */
  get month(): number {
    return this.currentDate.getMonth() + 1;
  }

  /** Day of the month (1–31). */
  get day(): number {
    return this.currentDate.getDate();
  }

  /** Hour (0–23). */
  get hour(): number {
    return this.currentDate.getHours();
  }

  /** Minute (0–59). */
  get minute(): number {
    return this.currentDate.getMinutes();
  }

  /** Second (0–59). */
  get second(): number {
    return this.currentDate.getSeconds();
  }

  /** Milliseconds (0–999). */
  get millisecond(): number {
    return this.currentDate.getMilliseconds();
  }

  /** Quarter of the year (1–4). Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec. */
  get quarter(): number {
    return Math.ceil((this.currentDate.getMonth() + 1) / 3);
  }

  /** ISO week-year — the year that owns the current ISO week. May differ from `.year` at year boundaries. */
  get weekYear(): number {
    return isoWeekYear(this.currentDate);
  }

  /** Day of the year (1–365, or 1–366 in a leap year). */
  get dayOfYear(): number {
    const d = this.currentDate;
    // Project local calendar date into UTC so the ms division is exact regardless of DST.
    const start = Date.UTC(d.getFullYear(), 0, 0);
    const current = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((current - start) / 86400000);
  }

  /** Day of the week (0 = Sunday, 6 = Saturday). */
  get dayOfWeek(): number {
    return this.currentDate.getDay();
  }

  /** Returns the number of days in the current month (28–31). */
  getDaysInMonth(): number {
    return new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0,
    ).getDate();
  }

  /** Returns the ISO 8601 week number (1–53). */
  getWeekNumber(): number {
    return isoWeekNumber(this.currentDate);
  }

  /** Returns the number of days in the current year (365 or 366). Returns `NaN` for invalid dates. */
  daysInYear(): number {
    if (!this.isValid()) return NaN;
    return this.isLeapYear() ? 366 : 365;
  }

  /** Returns `true` if the current year is a leap year. Returns `false` for invalid dates. */
  isLeapYear(): boolean {
    if (!this.isValid()) return false;
    const year = this.currentDate.getFullYear();
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  // --- Start / End ---

  /** Returns a new `Badger` at the start of the given unit. Does not mutate the original. */
  startOf(unit: UnitOfTime): Badger {
    const clone = this.clone();
    const d = clone.currentDate;
    switch (unit) {
      case "second":
        d.setMilliseconds(0);
        break;
      case "minute":
        d.setSeconds(0, 0);
        break;
      case "hour":
        d.setMinutes(0, 0, 0);
        break;
      case "day":
        d.setHours(0, 0, 0, 0);
        break;
      case "week": {
        const day = d.getDay();
        const diff = day === 0 ? 6 : day - 1;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        break;
      }
      case "quarter": {
        const startMonth = (Math.ceil((d.getMonth() + 1) / 3) - 1) * 3;
        d.setMonth(startMonth, 1);
        d.setHours(0, 0, 0, 0);
        break;
      }
      case "month":
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
      case "year":
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        break;
      case "millisecond":
        // Millisecond is the finest unit — already at full precision, return clone unchanged.
        break;
      default:
        throw new TypeError(`startOf: unknown unit "${unit as string}"`);
    }
    return clone;
  }

  /** Returns a new `Badger` at the end of the given unit. Does not mutate the original. */
  endOf(unit: UnitOfTime): Badger {
    const clone = this.clone();
    const d = clone.currentDate;
    switch (unit) {
      case "second":
        d.setMilliseconds(999);
        break;
      case "minute":
        d.setSeconds(59, 999);
        break;
      case "hour":
        d.setMinutes(59, 59, 999);
        break;
      case "day":
        d.setHours(23, 59, 59, 999);
        break;
      case "week": {
        const day = d.getDay();
        const diff = day === 0 ? 0 : 7 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(23, 59, 59, 999);
        break;
      }
      case "quarter": {
        const endMonth = Math.ceil((d.getMonth() + 1) / 3) * 3;
        d.setMonth(endMonth, 0);
        d.setHours(23, 59, 59, 999);
        break;
      }
      case "month":
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        d.setHours(23, 59, 59, 999);
        break;
      case "year":
        d.setMonth(11, 31);
        d.setHours(23, 59, 59, 999);
        break;
      case "millisecond":
        // Millisecond is the finest unit — already at full precision, return clone unchanged.
        break;
      default:
        throw new TypeError(`endOf: unknown unit "${unit as string}"`);
    }
    return clone;
  }

  // --- Add / Subtract ---

  /**
   * Returns a new `Badger` with the given amount added. Does not mutate the original.
   *
   * Accepts either `(amount, unit)` or a duration object with plural or singular keys.
   * Month and year addition clamps to the last valid day when the target month is shorter
   * than the source day (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3).
   *
   * @example
   * ```ts
   * const dt = new Badger("2026-01-31T00:00:00Z");
   * dt.add(1, "month").toISOString()               // "2026-02-28T00:00:00.000Z" (clamped)
   * dt.add({ days: 7, hours: 2 }).toISOString()    // add 7 days and 2 hours at once
   * dt.add({ months: 1, days: 5 }).toISOString()   // chain multiple units
   * ```
   */
  add(amount: number | Partial<DurationObject>, unit?: UnitOfTime): Badger {
    if (typeof amount === "object") {
      const units: Array<[UnitOfTime, number]> = [
        ["year", amount.years ?? amount.year ?? 0],
        ["month", amount.months ?? amount.month ?? 0],
        ["week", amount.weeks ?? amount.week ?? 0],
        ["day", amount.days ?? amount.day ?? 0],
        ["hour", amount.hours ?? amount.hour ?? 0],
        ["minute", amount.minutes ?? amount.minute ?? 0],
        ["second", amount.seconds ?? amount.second ?? 0],
        ["millisecond", amount.milliseconds ?? amount.millisecond ?? 0],
      ];
      return units.reduce(
        (acc, [u, v]) => (v !== 0 ? acc.add(v, u) : acc),
        this as Badger,
      );
    }
    if (unit === undefined) throw new TypeError("add: unit is required when amount is a number");
    if (!Number.isFinite(amount)) throw new RangeError(`add: amount must be a finite number, got ${amount}`);
    return this._addUnit(amount, unit);
  }

  private _addUnit(amount: number, unit: UnitOfTime): Badger {
    const clone = this.clone();
    const date = clone.currentDate;
    switch (unit) {
      case "year": {
        const dayBefore = date.getDate();
        date.setFullYear(date.getFullYear() + amount);
        if (date.getDate() !== dayBefore) date.setDate(0);
        break;
      }
      case "month": {
        const dayBefore = date.getDate();
        date.setMonth(date.getMonth() + amount);
        if (date.getDate() !== dayBefore) date.setDate(0);
        break;
      }
      case "quarter": {
        const dayBefore = date.getDate();
        date.setMonth(date.getMonth() + amount * 3);
        if (date.getDate() !== dayBefore) date.setDate(0);
        break;
      }
      case "week":
        date.setDate(date.getDate() + amount * 7);
        break;
      case "day":
        date.setDate(date.getDate() + amount);
        break;
      case "hour":
        date.setHours(date.getHours() + amount);
        break;
      case "minute":
        date.setMinutes(date.getMinutes() + amount);
        break;
      case "second":
        date.setSeconds(date.getSeconds() + amount);
        break;
      case "millisecond":
        date.setTime(date.getTime() + amount);
        break;
      default:
        throw new TypeError(`add: unknown unit "${unit as string}"`);
    }
    return clone;
  }

  /**
   * Returns a new `Badger` with a single field replaced. Does not mutate the original.
   *
   * Month is 1-indexed (1 = January). Setting the month clamps the day to the last valid
   * day of the target month (e.g. Jan 31 → set month to Feb → Feb 28).
   *
   * @example
   * ```ts
   * const dt = new Badger("2026-06-15T10:30:00Z");
   * dt.set("hour", 9).toISOString()   // "2026-06-15T09:30:00.000Z"
   * dt.set("month", 1).toISOString()  // "2026-01-15T10:30:00.000Z"
   * ```
   */
  set(unit: Exclude<UnitOfTime, "week" | "quarter">, value: number): Badger {
    if (!Number.isFinite(value)) throw new RangeError(`set(${unit}): value must be a finite number, got ${value}`);
    if (unit === "month" && (value < 1 || value > 12)) throw new RangeError(`month must be 1–12, got ${value}`);
    if (unit === "day" && (value < 1 || value > 31)) throw new RangeError(`day must be 1–31, got ${value}`);
    if (unit === "hour" && (value < 0 || value > 23)) throw new RangeError(`hour must be 0–23, got ${value}`);
    if (unit === "minute" && (value < 0 || value > 59)) throw new RangeError(`minute must be 0–59, got ${value}`);
    if (unit === "second" && (value < 0 || value > 59)) throw new RangeError(`second must be 0–59, got ${value}`);
    if (unit === "millisecond" && (value < 0 || value > 999)) throw new RangeError(`millisecond must be 0–999, got ${value}`);
    const clone = this.clone();
    const d = clone.currentDate;
    switch (unit) {
      case "year": {
        const dayBefore = d.getDate();
        d.setFullYear(value);
        if (d.getDate() !== dayBefore) d.setDate(0);
        break;
      }
      case "month": {
        const dayBefore = d.getDate();
        d.setMonth(value - 1);
        if (d.getDate() !== dayBefore) d.setDate(0);
        break;
      }
      case "day": {
        const originalMonth = d.getMonth();
        d.setDate(value);
        if (d.getMonth() !== originalMonth) d.setDate(0);
        break;
      }
      case "hour":
        d.setHours(value);
        break;
      case "minute":
        d.setMinutes(value);
        break;
      case "second":
        d.setSeconds(value);
        break;
      case "millisecond":
        d.setMilliseconds(value);
        break;
      default:
        throw new TypeError(`set: unknown unit "${unit as string}"`);
    }
    return clone;
  }

  /** Returns a new `Badger` with the given amount subtracted. Does not mutate the original.
   *  Accepts either `(amount, unit)` or a duration object — same form as `add`. */
  subtract(
    amount: number | Partial<DurationObject>,
    unit?: UnitOfTime,
  ): Badger {
    if (typeof amount === "object") {
      const negated = Object.fromEntries(
        /* v8 ignore next */
        Object.entries(amount).map(([k, v]) => [k, -(v ?? 0)]),
      ) as Partial<DurationObject>;
      return this.add(negated);
    }
    if (unit === undefined) throw new TypeError("subtract: unit is required when amount is a number");
    if (!Number.isFinite(amount)) throw new RangeError(`subtract: amount must be a finite number, got ${amount}`);
    return this.add(-amount, unit);
  }

  // --- Comparison ---

  /** Returns `true` if this date is strictly before `other`. */
  isBefore(other: Badger | Date): boolean {
    const otherTime =
      other instanceof Badger ? other.toDate().getTime() : other.getTime();
    return this.currentDate.getTime() < otherTime;
  }

  /** Returns `true` if this date is strictly after `other`. */
  isAfter(other: Badger | Date): boolean {
    const otherTime =
      other instanceof Badger ? other.toDate().getTime() : other.getTime();
    return this.currentDate.getTime() > otherTime;
  }

  /**
   * Returns `true` if both dates are equal.
   * When `unit` is provided, compares only down to that granularity — finer units are ignored.
   *
   * @example
   * ```ts
   * const a = new Badger("2026-06-15T10:30:00Z");
   * const b = new Badger("2026-06-15T22:00:00Z");
   *
   * a.isSame(b)         // false (different ms timestamp)
   * a.isSame(b, "day")  // true  (same calendar day)
   * a.isSame(b, "hour") // false (different hour)
   * ```
   */
  isSame(other: Badger | Date, unit?: UnitOfTime): boolean {
    const otherDate =
      other instanceof Badger ? other.toDate() : new Date(other.getTime());
    if (!unit) {
      return this.currentDate.getTime() === otherDate.getTime();
    }
    switch (unit) {
      case "year":
        return this.currentDate.getFullYear() === otherDate.getFullYear();
      case "week":
        return (
          isoWeekNumber(this.currentDate) === isoWeekNumber(otherDate) &&
          isoWeekYear(this.currentDate) === isoWeekYear(otherDate)
        );
      case "month":
        return (
          this.currentDate.getFullYear() === otherDate.getFullYear() &&
          this.currentDate.getMonth() === otherDate.getMonth()
        );
      case "day":
        return (
          this.currentDate.getFullYear() === otherDate.getFullYear() &&
          this.currentDate.getMonth() === otherDate.getMonth() &&
          this.currentDate.getDate() === otherDate.getDate()
        );
      case "hour":
        return (
          this.currentDate.getFullYear() === otherDate.getFullYear() &&
          this.currentDate.getMonth() === otherDate.getMonth() &&
          this.currentDate.getDate() === otherDate.getDate() &&
          this.currentDate.getHours() === otherDate.getHours()
        );
      case "minute":
        return (
          this.currentDate.getFullYear() === otherDate.getFullYear() &&
          this.currentDate.getMonth() === otherDate.getMonth() &&
          this.currentDate.getDate() === otherDate.getDate() &&
          this.currentDate.getHours() === otherDate.getHours() &&
          this.currentDate.getMinutes() === otherDate.getMinutes()
        );
      case "second":
        return (
          this.currentDate.getFullYear() === otherDate.getFullYear() &&
          this.currentDate.getMonth() === otherDate.getMonth() &&
          this.currentDate.getDate() === otherDate.getDate() &&
          this.currentDate.getHours() === otherDate.getHours() &&
          this.currentDate.getMinutes() === otherDate.getMinutes() &&
          this.currentDate.getSeconds() === otherDate.getSeconds()
        );
      case "quarter":
        return (
          this.currentDate.getFullYear() === otherDate.getFullYear() &&
          Math.ceil((this.currentDate.getMonth() + 1) / 3) === Math.ceil((otherDate.getMonth() + 1) / 3)
        );
      case "millisecond":
        return this.currentDate.getTime() === otherDate.getTime();
      default:
        throw new TypeError(`isSame: unknown unit "${unit as string}"`);
    }
  }

  /**
   * Returns `true` if this date is before or equal to `other`.
   * When `unit` is provided, compares only down to that granularity.
   * Equivalent to `isBefore(other) || isSame(other)`.
   *
   * @example
   * ```ts
   * const deadline = new Badger("2026-06-30T00:00:00Z");
   * new Badger("2026-06-30T00:00:00Z").isSameOrBefore(deadline)          // true  (equal)
   * new Badger("2026-06-29T00:00:00Z").isSameOrBefore(deadline)          // true  (before)
   * new Badger("2026-06-30T23:59:59Z").isSameOrBefore(deadline, "day")   // true  (same day)
   * new Badger("2026-07-01T00:00:00Z").isSameOrBefore(deadline)          // false (after)
   * ```
   */
  isSameOrBefore(other: Badger | Date, unit?: UnitOfTime): boolean {
    if (unit) return this.isSame(other, unit) || this.isBefore(other);
    const otherTime =
      other instanceof Badger ? other.toDate().getTime() : other.getTime();
    return this.currentDate.getTime() <= otherTime;
  }

  /**
   * Returns `true` if this date is after or equal to `other`.
   * When `unit` is provided, compares only down to that granularity.
   * Equivalent to `isAfter(other) || isSame(other)`.
   *
   * @example
   * ```ts
   * const start = new Badger("2026-06-01T00:00:00Z");
   * new Badger("2026-06-01T00:00:00Z").isSameOrAfter(start)          // true  (equal)
   * new Badger("2026-06-02T00:00:00Z").isSameOrAfter(start)          // true  (after)
   * new Badger("2026-06-01T23:59:59Z").isSameOrAfter(start, "day")   // true  (same day)
   * new Badger("2026-05-31T00:00:00Z").isSameOrAfter(start)          // false (before)
   * ```
   */
  isSameOrAfter(other: Badger | Date, unit?: UnitOfTime): boolean {
    if (unit) return this.isSame(other, unit) || this.isAfter(other);
    const otherTime =
      other instanceof Badger ? other.toDate().getTime() : other.getTime();
    return this.currentDate.getTime() >= otherTime;
  }

  /**
   * Returns this date constrained to the range `[min, max]`.
   * If the date is before `min`, returns `min`. If after `max`, returns `max`. Otherwise returns itself.
   *
   * @example
   * ```ts
   * const min = new Badger("2026-01-01T00:00:00Z");
   * const max = new Badger("2026-12-31T00:00:00Z");
   *
   * new Badger("2025-06-15T00:00:00Z").clamp(min, max) // → min (too early)
   * new Badger("2027-06-15T00:00:00Z").clamp(min, max) // → max (too late)
   * new Badger("2026-06-15T00:00:00Z").clamp(min, max) // → unchanged
   * ```
   */
  clamp(min: Badger | Date, max: Badger | Date): Badger {
    const minTime = min instanceof Badger ? min.toDate().getTime() : min.getTime();
    const maxTime = max instanceof Badger ? max.toDate().getTime() : max.getTime();
    if (isNaN(minTime) || isNaN(maxTime)) throw new RangeError("clamp: min and max must be valid dates");
    if (minTime > maxTime) throw new RangeError("clamp: min must not be after max");
    if (this.isBefore(min))
      return min instanceof Badger ? min.clone() : new Badger(min);
    if (this.isAfter(max))
      return max instanceof Badger ? max.clone() : new Badger(max);
    return this.clone();
  }

  /**
   * Returns `true` if this date falls between `start` and `end`.
   *
   * Both boundaries are **exclusive** by default — the boundary dates themselves return `false`.
   * Use `includeStart` / `includeEnd` to make either boundary inclusive.
   *
   * @example
   * ```ts
   * const open  = new Badger("2026-06-01T00:00:00Z");
   * const close = new Badger("2026-06-30T00:00:00Z");
   * const date  = new Badger("2026-06-15T00:00:00Z");
   *
   * date.isBetween(open, close)                                        // true  (exclusive both ends)
   * open.isBetween(open, close)                                        // false (open itself excluded)
   * open.isBetween(open, close, { includeStart: true })                // true  (open included)
   * close.isBetween(open, close, { includeEnd: true })                 // true  (close included)
   * open.isBetween(open, close, { includeStart: true, includeEnd: true }) // true  (both included)
   * ```
   */
  isBetween(
    start: Badger | Date,
    end: Badger | Date,
    options: { includeStart?: boolean; includeEnd?: boolean } = {},
  ): boolean {
    const startTime = start instanceof Badger ? start.toDate().getTime() : start.getTime();
    const endTime = end instanceof Badger ? end.toDate().getTime() : end.getTime();
    if (isNaN(startTime) || isNaN(endTime)) throw new RangeError("isBetween: start and end must be valid dates");
    if (startTime > endTime) throw new RangeError("isBetween: start must not be after end");
    const afterStart = options.includeStart
      ? this.isSameOrAfter(start)
      : this.isAfter(start);
    const beforeEnd = options.includeEnd
      ? this.isSameOrBefore(end)
      : this.isBefore(end);
    return afterStart && beforeEnd;
  }

  /** Returns `true` if this date is strictly in the past (before the current instant). */
  isPast(): boolean {
    return this.currentDate.getTime() < Date.now();
  }

  /** Returns `true` if this date is strictly in the future (after the current instant). */
  isFuture(): boolean {
    return this.currentDate.getTime() > Date.now();
  }

  /** Returns `true` if the date is today (local time). */
  isToday(): boolean {
    return this.isSame(new Badger(), "day");
  }

  /** Returns `true` if the date is yesterday (local time). */
  isYesterday(): boolean {
    return this.isSame(new Badger().subtract(1, "day"), "day");
  }

  /** Returns `true` if the date is tomorrow (local time). */
  isTomorrow(): boolean {
    return this.isSame(new Badger().add(1, "day"), "day");
  }

  /** Returns `true` if the date falls on Saturday or Sunday (local day of week). Returns `false` for invalid dates. */
  isWeekend(): boolean {
    if (!this.isValid()) return false;
    const day = this.currentDate.getDay();     // local — consistent with .dayOfWeek getter
    return day === 0 || day === 6;
  }

  /** Returns `true` if the date falls on Monday–Friday (local day of week). Returns `false` for invalid dates. */
  isWeekday(): boolean {
    if (!this.isValid()) return false;
    return !this.isWeekend();
  }

  // --- Countdown ---

  /**
   * Returns the time remaining until this date as `{ days, hours, minutes, seconds }`.
   * All values are non-negative whole numbers.
   * Returns `null` if the date is in the past or equal to `relativeTo`.
   *
   * @param relativeTo - Anchor date to count down from. Defaults to `new Date()`.
   *
   * @example
   * ```ts
   * Badger("2026-12-25").countdown()
   * // { days: 207, hours: 4, minutes: 32, seconds: 11 }
   *
   * // Pair with Sett().formatDuration() for a display string
   * Sett(new Date(), locale).formatDuration(Badger("2026-12-25").countdown())
   * ```
   */
  countdown(relativeTo?: Date): { days: number; hours: number; minutes: number; seconds: number } | null {
    if (!this.isValid()) return null;
    const now = relativeTo ?? new Date();
    if (isNaN(now.getTime())) return null;
    const diffMs = this.currentDate.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const days    = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
  }

  // --- Business days ---

  /**
   * Returns the weekend day numbers (ISO: 1=Mon…7=Sun) for the given locale.
   * Resolution order: explicit `locale` arg → `BadgerSettings.defaultLocale` → `[6, 7]` (Sat, Sun).
   */
  private getWeekend(locale?: Intl.Locale): number[] {
    const resolved = locale ?? BadgerSettings.defaultLocale;
    /* v8 ignore next 2 */
    if (!resolved) return [6, 7];
    return (resolved as any).weekInfo?.weekend ?? [6, 7];
  }

  /**
   * Build a validated lookup Set of public-holiday dates. badger-time ships NO
   * holiday data — the caller injects the dates they care about (typically from
   * a source such as `date-holidays`, keyed off their region). Every entry is
   * validated by {@link assertISODate}; an omitted set returns the shared empty
   * set ("weekends only"), and a `Set` argument is validated and returned as-is
   * (no copy). Throws if any entry is not a real ISO `YYYY-MM-DD` date.
   */
  private static buildHolidaySet(holidays?: Iterable<string>): ReadonlySet<string> {
    if (!holidays) return EMPTY_HOLIDAYS;
    if (holidays instanceof Set) {
      for (const h of holidays) Badger.assertISODate(h);
      return holidays;
    }
    const set = new Set<string>();
    for (const h of holidays) {
      Badger.assertISODate(h);
      set.add(h);
    }
    return set;
  }

  /**
   * Assert that `value` is a strict ISO `YYYY-MM-DD` string AND a real calendar
   * date. Rejects national formats (`25/12/2026`), datetimes, unpadded/whitespace
   * variants, and impossible dates (`2026-13-25`, `2026-02-30`) — so a bad holiday
   * fails loudly here instead of silently never matching a lookup key.
   * @throws {RangeError} If the value is not a real ISO `YYYY-MM-DD` date.
   */
  private static assertISODate(value: string): void {
    if (typeof value !== "string" || !ISO_DATE_ONLY.test(value)) {
      throw new RangeError(
        `holiday must be an ISO 'YYYY-MM-DD' date string, got ${JSON.stringify(value)}`,
      );
    }
    // Shape is valid — now reject impossible calendar dates (month 13, day 32,
    // Feb 30, etc.) so they fail loudly instead of silently never matching a key.
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      throw new RangeError(`holiday is not a real calendar date: ${JSON.stringify(value)}`);
    }
  }

  /**
   * The LOCAL calendar date as `YYYY-MM-DD`. This is the holiday-lookup key —
   * built from local components so it matches the local weekend evaluation
   * (using `toISOString().slice(0,10)` would key off UTC and mis-match for dates
   * near midnight in non-UTC zones).
   */
  private localDateKey(): string {
    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth() + 1;
    const d = this.currentDate.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  /**
   * Returns `true` if the date is a business day — i.e. neither a weekend nor a
   * supplied public holiday. Invalid dates return `false`.
   *
   * Resolution order for the weekend definition: explicit `locale` arg →
   * `BadgerSettings.defaultLocale` → Saturday+Sunday.
   *
   * @param locale - Weekend definition source. Omit to use the global default.
   * @param holidays - Optional public holidays to also treat as non-business
   *   days. badger-time ships no holiday data — pass your own (e.g. from
   *   `date-holidays`, keyed off the user's region). Each entry must be a strict
   *   ISO `YYYY-MM-DD` string; a malformed, localized (`25/12/2026`), or
   *   impossible (`2026-02-30`) value throws a `RangeError` rather than silently
   *   never matching. Accepts an array or a `Set`; omitted/empty = weekends only.
   *   Matched against the date's LOCAL calendar day, consistent with the weekend
   *   evaluation.
   * @throws {RangeError} If any holiday string is not a real ISO `YYYY-MM-DD` date.
   */
  isBusinessDay(locale?: Intl.Locale, holidays?: Iterable<string>): boolean {
    const holidaySet = Badger.buildHolidaySet(holidays); // validate first, even for invalid dates
    if (!this.isValid()) return false;
    const weekend = this.getWeekend(locale);
    const jsDay = this.currentDate.getDay();    // local — consistent with .dayOfWeek getter
    const isoDay = jsDay === 0 ? 7 : jsDay;
    if (weekend.includes(isoDay)) return false;
    return !holidaySet.has(this.localDateKey());
  }

  /**
   * Returns a new `Badger` that is `n` business days after this date, skipping
   * both weekends (per the locale) and any supplied public holidays. The start
   * day itself is never tested — only the days stepped onto — so `n = 0` returns
   * an unchanged clone even if today is a weekend or holiday.
   *
   * Day-of-week is evaluated in local time (consistent with `.dayOfWeek` and other
   * getters). The date is stepped with `setUTCDate` to avoid DST edge-cases where
   * a local "add one day" can land on the wrong calendar date.
   *
   * @param n - Number of business days to advance. Must be a non-negative integer.
   * @param locale - Weekend definition source. Omit to use the global default.
   * @param holidays - Optional public holidays to skip, same contract as
   *   {@link isBusinessDay}: strict ISO `YYYY-MM-DD` strings (array or `Set`),
   *   validated, local-date keyed, omitted/empty = weekends only.
   * @throws {RangeError} If `n` is not a non-negative integer, if any holiday
   *   string is invalid, or if the holiday set blocks every reachable day (the
   *   walk is bounded, so a pathological set throws instead of looping forever).
   */
  addBusinessDays(n: number, locale?: Intl.Locale, holidays?: Iterable<string>): Badger {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new RangeError(`addBusinessDays: n must be a non-negative integer, got ${n}`);
    const holidaySet = Badger.buildHolidaySet(holidays);
    if (!this.isValid()) return this.clone();
    const weekend = this.getWeekend(locale);
    let result = new Date(this.currentDate);
    let remaining = n;
    let guard = (n + 1) * MAX_STEPS_PER_BUSINESS_DAY;
    while (remaining > 0) {
      if (guard-- <= 0) throw new RangeError(`addBusinessDays: could not find ${n} business day(s) — the holiday set appears to block every reachable day`);
      result.setUTCDate(result.getUTCDate() + 1);
      const jsDay = result.getDay();            // local day-of-week
      const isoDay = jsDay === 0 ? 7 : jsDay;
      if (!weekend.includes(isoDay) && !holidaySet.has(localKey(result))) remaining--;
    }
    return new Badger(result);
  }

  /**
   * Returns a new `Badger` that is `n` business days before this date, skipping
   * both weekends (per the locale) and any supplied public holidays. The start
   * day itself is never tested — only the days stepped onto — so `n = 0` returns
   * an unchanged clone even if today is a weekend or holiday.
   *
   * Day-of-week is evaluated in local time (consistent with `.dayOfWeek` and other
   * getters). The date is stepped with `setUTCDate` to avoid DST edge-cases.
   *
   * @param n - Number of business days to go back. Must be a non-negative integer.
   * @param locale - Weekend definition source. Omit to use the global default.
   * @param holidays - Optional public holidays to skip, same contract as
   *   {@link isBusinessDay}: strict ISO `YYYY-MM-DD` strings (array or `Set`),
   *   validated, local-date keyed, omitted/empty = weekends only.
   * @throws {RangeError} If `n` is not a non-negative integer, if any holiday
   *   string is invalid, or if the holiday set blocks every reachable day (the
   *   walk is bounded, so a pathological set throws instead of looping forever).
   */
  subtractBusinessDays(n: number, locale?: Intl.Locale, holidays?: Iterable<string>): Badger {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new RangeError(`subtractBusinessDays: n must be a non-negative integer, got ${n}`);
    const holidaySet = Badger.buildHolidaySet(holidays);
    if (!this.isValid()) return this.clone();
    const weekend = this.getWeekend(locale);
    let result = new Date(this.currentDate);
    let remaining = n;
    let guard = (n + 1) * MAX_STEPS_PER_BUSINESS_DAY;
    while (remaining > 0) {
      if (guard-- <= 0) throw new RangeError(`subtractBusinessDays: could not find ${n} business day(s) — the holiday set appears to block every reachable day`);
      result.setUTCDate(result.getUTCDate() - 1);
      const jsDay = result.getDay();            // local day-of-week
      const isoDay = jsDay === 0 ? 7 : jsDay;
      if (!weekend.includes(isoDay) && !holidaySet.has(localKey(result))) remaining--;
    }
    return new Badger(result);
  }

  // --- Diff ---

  /**
   * Returns the difference between this date and `other` in the given unit.
   * Positive when `this` is after `other`, negative when before.
   *
   * By default the result is floored to a whole number. Pass `float: true` to get
   * the fractional value — useful for progress bars or overlap calculations.
   *
   * Month and year diffs are calendar-based, not ms-based. Only the month (and year)
   * components are compared — day-of-month is ignored. Jan 1 → Jan 31 = 0 months
   * (same calendar month); Jan 31 → Feb 1 = 1 month (different calendar months,
   * even though they are only 1 day apart).
   *
   * @example
   * ```ts
   * const a = new Badger("2026-06-15T10:30:00Z");
   * const b = new Badger("2026-06-15T09:00:00Z");
   *
   * a.diff(b, "hour")        // 1   (floored)
   * a.diff(b, "hour", true)  // 1.5 (fractional)
   * b.diff(a, "minute")      // -90 (negative — b is before a)
   * ```
   */
  diff(other: Badger | Date, unit: UnitOfTime, float?: boolean): number {
    const otherTime =
      other instanceof Badger ? other.toDate().getTime() : other.getTime();
    const diffMs = this.currentDate.getTime() - otherTime;
    const trunc = float ? (n: number) => n : Math.floor;

    switch (unit) {
      case "millisecond":
        return diffMs;
      case "second":
        return trunc(diffMs / 1000);
      case "minute":
        return trunc(diffMs / 60000);
      case "hour":
        return trunc(diffMs / 3600000);
      case "day": {
        if (float) return diffMs / 86400000;
        // Integer path: project local calendar dates into UTC so the count is exact across DST.
        const d1 = this.currentDate;
        const d2 = other instanceof Badger ? other.toDate() : other;
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return Math.floor((utc1 - utc2) / 86400000);
      }
      case "week": {
        if (float) return diffMs / 604800000;
        const d1 = this.currentDate;
        const d2 = other instanceof Badger ? other.toDate() : other;
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return Math.floor((utc1 - utc2) / 604800000);
      }
      case "month": {
        const d1 = this.currentDate;
        const d2 = other instanceof Badger ? other.toDate() : other;
        return (
          (d1.getFullYear() - d2.getFullYear()) * 12 +
          (d1.getMonth() - d2.getMonth())
        );
      }
      case "quarter": {
        const d1 = this.currentDate;
        const d2 = other instanceof Badger ? other.toDate() : other;
        return (
          (d1.getFullYear() - d2.getFullYear()) * 4 +
          (Math.ceil((d1.getMonth() + 1) / 3) - Math.ceil((d2.getMonth() + 1) / 3))
        );
      }
      case "year": {
        const d1 = this.currentDate;
        const d2 = other instanceof Badger ? other.toDate() : other;
        return d1.getFullYear() - d2.getFullYear();
      }
      default:
        throw new TypeError(`diff: unknown unit "${unit as string}"`);
    }
  }
}
