type UnitOfTime = "year" | "month" | "week" | "day" | "hour" | "minute" | "millisecond";

/** Returns the ISO 8601 week number (1–53) for a given Date. */
function isoWeekNumber(d: Date): number {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const jan4 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
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
        } else if (dateTime) {
            const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateTime);
            const hasTimezoneIndicator = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateTime);
            this.currentDate = new Date(isDateOnly || hasTimezoneIndicator ? dateTime : dateTime + "Z");
        } else {
            this.currentDate = new Date(Date.now());
        }
    }

    /**
     * Creates a DateTime from a local date string and time string, avoiding UTC conversion.
     *
     * The standard constructor appends `Z` to bare strings, treating them as UTC and shifting
     * the local time by the UTC offset. Use this factory when you have an explicit
     * `"YYYY-MM-DD"` + `"HH:mm"` pair that represents local wall-clock time — for example,
     * a user-selected pickup date and time.
     *
     * @param date - ISO date string `"YYYY-MM-DD"`
     * @param time - Time string `"HH:mm"`
     * @returns DateTime representing the given local date and time.
     *
     * @example
     * const dt = Badger.fromLocal("2026-05-22", "00:15");
     * dt.hour;      // 0  (local midnight — not shifted to UTC)
     * dt.dayOfWeek; // 5  (Friday, correct local day of week)
     */
    static fromLocal(date: string, time: string): Badger {
        const [year, month, day] = date.split("-").map(Number);
        const [h, m] = time.split(":").map(Number);
        return new Badger(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, h ?? 0, m ?? 0, 0, 0));
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

    /** Returns the ISO 8601 string representation. */
    toISOString(): string {
        return this.currentDate.toISOString();
    }

    /** Returns the Unix timestamp in seconds. */
    toUnixTimestamp(): number {
        return Math.floor(this.currentDate.getTime() / 1000);
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

    /** Day of the week (0 = Sunday, 6 = Saturday). */
    get dayOfWeek(): number {
        return this.currentDate.getDay();
    }

    /** Returns the number of days in the current month (28–31). */
    getDaysInMonth(): number {
        return new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0).getDate();
    }

    /** Returns the ISO 8601 week number (1–53). */
    getWeekNumber(): number {
        return isoWeekNumber(this.currentDate);
    }

    /** Returns `true` if the current year is a leap year. */
    isLeapYear(): boolean {
        const year = this.currentDate.getFullYear();
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // --- Start / End ---

    /** Returns a new `Badger` at the start of the given unit. Does not mutate the original. */
    startOf(unit: UnitOfTime): Badger {
        const clone = this.clone();
        const d = clone.currentDate;
        switch (unit) {
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
            case "month":
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                break;
            case "year":
                d.setMonth(0, 1);
                d.setHours(0, 0, 0, 0);
                break;
        }
        return clone;
    }

    /** Returns a new `Badger` at the end of the given unit. Does not mutate the original. */
    endOf(unit: UnitOfTime): Badger {
        const clone = this.clone();
        const d = clone.currentDate;
        switch (unit) {
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
            case "month":
                d.setMonth(d.getMonth() + 1);
                d.setDate(0);
                d.setHours(23, 59, 59, 999);
                break;
            case "year":
                d.setMonth(11, 31);
                d.setHours(23, 59, 59, 999);
                break;
        }
        return clone;
    }

    // --- Add / Subtract ---

    /** Returns a new `Badger` with the given amount added. Does not mutate the original. */
    add(amount: number, unit: UnitOfTime): Badger {
        const clone = this.clone();
        const date = clone.currentDate;
        switch (unit) {
            case "year": {
                const dayBefore = date.getDate();
                date.setFullYear(date.getFullYear() + amount);
                if (date.getDate() !== dayBefore) {
                    date.setDate(0);
                }
                break;
            }
            case "month": {
                const dayBefore = date.getDate();
                date.setMonth(date.getMonth() + amount);
                if (date.getDate() !== dayBefore) {
                    date.setDate(0);
                }
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
            case "millisecond":
                date.setTime(date.getTime() + amount);
                break;
        }
        return clone;
    }

    /** Returns a new `Badger` with the given amount subtracted. Does not mutate the original. */
    subtract(amount: number, unit: UnitOfTime): Badger {
        return this.add(-amount, unit);
    }

    // --- Comparison ---

    /** Returns `true` if this date is strictly before `other`. */
    isBefore(other: Badger | Date): boolean {
        const otherTime = other instanceof Badger ? other.toDate().getTime() : other.getTime();
        return this.currentDate.getTime() < otherTime;
    }

    /** Returns `true` if this date is strictly after `other`. */
    isAfter(other: Badger | Date): boolean {
        const otherTime = other instanceof Badger ? other.toDate().getTime() : other.getTime();
        return this.currentDate.getTime() > otherTime;
    }

    /** Returns `true` if both dates are equal. When `unit` is provided, compares only down to that granularity. */
    isSame(other: Badger | Date, unit?: UnitOfTime): boolean {
        const otherDate = other instanceof Badger ? other.toDate() : new Date(other.getTime());
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
            default:
                return this.currentDate.getTime() === otherDate.getTime();
        }
    }

    /** Returns `true` if this date is strictly between `start` and `end` (exclusive). */
    isBetween(start: Badger | Date, end: Badger | Date): boolean {
        return this.isAfter(start) && this.isBefore(end);
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

    /** Returns `true` if the date falls on Saturday or Sunday. */
    isWeekend(): boolean {
        const day = this.currentDate.getDay();
        return day === 0 || day === 6;
    }

    /** Returns `true` if the date falls on Monday–Friday. */
    isWeekday(): boolean {
        return !this.isWeekend();
    }

    // --- Diff ---

    /** Returns the difference between this date and `other` in the given unit (positive when `this > other`). */
    diff(other: Badger | Date, unit: UnitOfTime): number {
        const otherTime = other instanceof Badger ? other.toDate().getTime() : other.getTime();
        const diffMs = this.currentDate.getTime() - otherTime;

        switch (unit) {
            case "millisecond":
                return diffMs;
            case "minute":
                return Math.floor(diffMs / 60000);
            case "hour":
                return Math.floor(diffMs / 3600000);
            case "day":
                return Math.floor(diffMs / 86400000);
            case "week":
                return Math.floor(diffMs / 604800000);
            case "month": {
                const d1 = this.currentDate;
                const d2 = other instanceof Badger ? other.toDate() : other;
                return (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth());
            }
            case "year": {
                const d1 = this.currentDate;
                const d2 = other instanceof Badger ? other.toDate() : other;
                return d1.getFullYear() - d2.getFullYear();
            }
        }
    }
}
