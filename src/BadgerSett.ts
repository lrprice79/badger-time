import { BadgerSettings } from "./BadgerSettings";
import { Badger } from "./Badger";

const defaultDateFormatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
};

type Month = "numeric" | "2-digit" | "long" | "short" | "narrow" | undefined;
type Weekday = "long" | "short" | "narrow" | undefined;

/**
 * Locale-aware date formatter built on `Intl.DateTimeFormat`.
 *
 * Defaults to `en-GB` locale and `Europe/London` time zone.
 *
 * @example
 * ```ts
 * const df = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
 * df.formatDate();          // "15/03/2026 10:30:45"
 * df.formatForBackend();    // "2026-03-15T10:30:45.000Z"
 * df.getDayName();          // "Sunday"
 * df.formatRelative();      // "in 2 days"
 * ```
 */
export class BadgerSett extends Intl.DateTimeFormat {
    readonly currentDate: Date;

    /**
     * @param date - Date to format. Defaults to `new Date()`.
     * @param locale - BCP 47 locale. Defaults to `en-GB`.
     * @param options - `Intl.DateTimeFormatOptions` override.
     */
    constructor(date?: Date | string, locale?: Intl.Locale, options?: Intl.DateTimeFormatOptions) {
        const resolvedLocale = locale ?? BadgerSettings.defaultLocale ?? new Intl.Locale("en-GB");
        const resolvedOptions = options ?? (
            BadgerSettings.defaultTimeZone
                ? { ...defaultDateFormatOptions, timeZone: BadgerSettings.defaultTimeZone }
                : defaultDateFormatOptions
        );
        super(resolvedLocale.baseName, resolvedOptions);
        if (typeof date === "string") {
            if (date === "") {
                this.currentDate = new Date(NaN);
            } else {
                const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
                const hasTimezoneIndicator = /(?:Z|[+-]\d{2}:?\d{2})$/.test(date);
                this.currentDate = new Date(isDateOnly || hasTimezoneIndicator ? date : date + "Z");
            }
        } else {
            this.currentDate = date ? new Date(date) : new Date();
        }
    }

    /** @throws {RangeError} if `currentDate` is not a valid date. */
    private assertDateValid(method: string): void {
        if (isNaN(this.currentDate.getTime())) {
            throw new RangeError(`BadgerSett.${method}(): date is not valid — check isNaN(currentDate.getTime()) first`);
        }
    }

    /** Returns the date as a UTC ISO 8601 string (e.g. `"2026-03-15T09:30:45.000Z"`), suitable for backend APIs. */
    formatForBackend(): string {
        this.assertDateValid("formatForBackend");
        return this.currentDate.toISOString();
    }

    /**
     * Returns a UTC ISO string representing midnight (00:00:00) in the configured timezone.
     * Does not mutate `currentDate`.
     */
    formatForBackendToStartOfDay(): string {
        this.assertDateValid("formatForBackendToStartOfDay");
        // Start of day = the FIRST UTC instant whose local calendar date matches
        // `currentDate`'s local date in the configured timezone.
        return new Date(this.firstInstantOfLocalDate(0)).toISOString();
    }

    /**
     * Returns a UTC ISO string representing end-of-day (23:59:59.999) in the configured timezone.
     * Does not mutate `currentDate`.
     */
    formatForBackendToEndOfDay(): string {
        this.assertDateValid("formatForBackendToEndOfDay");
        // End of day = the LAST UTC instant of the local date = one ms before the
        // first instant of the NEXT local date.
        return new Date(this.firstInstantOfLocalDate(1) - 1).toISOString();
    }

    /** The `YYYY-MM-DD` calendar date of an instant in the configured timezone. */
    private zonedDateKey(instant: Date, tz: string): string {
        const p = new Intl.DateTimeFormat("en-GB", {
            year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz,
        }).formatToParts(instant);
        const g = (t: string) => p.find(x => x.type === t)!.value;
        return `${g("year")}-${g("month")}-${g("day")}`;
    }

    /**
     * Returns the first UTC instant (ms) whose local calendar date in the
     * configured timezone is `dayOffset` days after `currentDate`'s local date.
     *
     * Found by binary search on the local-date boundary rather than offset
     * arithmetic. Local calendar date is monotonic non-decreasing in absolute
     * time, so the search is exact and DST-proof — it handles skipped/ambiguous
     * midnights, half-hour/45-minute offsets (Lord Howe, Chatham), and large
     * offsets where a naive "wall time as UTC" guess lands on the wrong side of
     * that day's transition (Sydney/Auckland on their fall-back day).
     */
    private firstInstantOfLocalDate(dayOffset: number): number {
        const tz = this.resolvedOptions().timeZone;
        // Target local date = currentDate's local date + dayOffset days.
        const [y, m, d] = this.zonedDateKey(this.currentDate, tz).split("-").map(Number);
        const targetMs = Date.UTC(y!, m! - 1, d! + dayOffset);
        const target = new Date(targetMs).toISOString().slice(0, 10);

        // Bracket: real UTC offsets are within ±14h, so ±30h around the naive
        // guess is guaranteed to straddle the boundary (lo before it, hi at/after).
        let lo = targetMs - 30 * 3600000;
        let hi = targetMs + 30 * 3600000;
        while (lo < hi) {
            const mid = lo + Math.floor((hi - lo) / 2);
            if (this.zonedDateKey(new Date(mid), tz) >= target) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }

    /** Formats the full date and time using the configured locale and options. */
    formatDate() {
        this.assertDateValid("formatDate");
        return this.format(this.currentDate);
    }

    /** Formats only the date portion (year, month, day) without time. */
    formatDateOnly() {
        this.assertDateValid("formatDateOnly");
        return new Intl.DateTimeFormat(this.resolvedOptions().locale, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: this.resolvedOptions().timeZone
        }).format(this.currentDate);
    }

    /** Formats only the time portion (hour, minute, second), using the locale's
     *  preferred hour cycle — 12-hour for en-US/ar-SA, 24-hour for en-GB/de-DE etc. */
    formatTimeOnly() {
        this.assertDateValid("formatTimeOnly");
        const locale = this.resolvedOptions().locale;
        const hourCycles = (new Intl.Locale(locale) as any).hourCycles as string[] | undefined;
        /* v8 ignore next 1 */
        const is12h = hourCycles?.[0] === "h11" || hourCycles?.[0] === "h12";
        return new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: is12h,
            timeZone: this.resolvedOptions().timeZone
        }).format(this.currentDate);
    }

    /** Returns the localised weekday name (e.g. `"Monday"`, `"Mon"`, `"M"`). */
    getDayName(format: Weekday = "long") {
        this.assertDateValid("getDayName");
        return new Intl.DateTimeFormat(this.resolvedOptions().locale, {
            weekday: format
        }).format(this.currentDate);
    }

    /** Returns the localised month name (e.g. `"March"`, `"Mar"`, `"M"`). */
    getMonthName(format: Month = "long") {
        this.assertDateValid("getMonthName");
        return new Intl.DateTimeFormat(this.resolvedOptions().locale, {
            month: format
        }).format(this.currentDate);
    }

    /** Returns all 7 weekday names starting from the locale's first day of week. */
    getDaysOfTheWeek(format: Weekday = "long"): string[] {
        const locale = this.resolvedOptions().locale;
        const formatter = new Intl.DateTimeFormat(locale, { weekday: format });

        // Determine the locale's first day of week via Intl.Locale weekInfo.
        // firstDay: 1 = Monday (ISO default), 7 = Sunday (en-US), 6 = Saturday.
        // Falls back to Monday if weekInfo is unavailable.
        let firstDayOfWeek = 1;
        /* v8 ignore next 6 */
        try {
            const locObj = new Intl.Locale(locale);
            const info = (locObj as any).weekInfo ?? (locObj as any).getWeekInfo?.();
            if (typeof info?.firstDay === "number") firstDayOfWeek = info.firstDay;
        } catch { /* keep Monday default */ }

        // Map Intl firstDay (1=Mon, 7=Sun) to JS day index (0=Sun, 1=Mon, …)
        const jsFirstDay = firstDayOfWeek === 7 ? 0 : firstDayOfWeek;

        // 2024-01-01 is a Monday (JS day 1). Offset from Monday to jsFirstDay.
        const mondayOffset = (jsFirstDay - 1 + 7) % 7;
        const monday = new Date(2024, 0, 1);

        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + mondayOffset + i);
            return formatter.format(day);
        });
    }

    /** Returns all 12 month names (January–December) in the configured locale. */
    getMonthsOfTheYear(format: Month = "long"): string[] {
        const locale = this.resolvedOptions().locale;
        const formatter = new Intl.DateTimeFormat(locale, { month: format });
        return Array.from({ length: 12 }, (_, i) => {
            return formatter.format(new Date(2024, i, 1));
        });
    }

    /**
     * Returns `true` if `currentDate` falls on a weekend day as defined by the
     * configured locale's `weekInfo.weekend` (e.g. Fri+Sat for `ar-SA`).
     * Falls back to Saturday+Sunday when `weekInfo` is unavailable.
     */
    isWeekend(): boolean {
        const locObj = new Intl.Locale(this.resolvedOptions().locale);
        /* v8 ignore next 1 */
        const weekend: number[] = (locObj as any).weekInfo?.weekend ?? [6, 7];
        // Use local getDay() — consistent with Badger.isWeekend and the .dayOfWeek getter.
        const jsDay = this.currentDate.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        return weekend.includes(isoDay);
    }

    /**
     * Returns a new `Date` at local midnight of the first day of the week
     * for the configured locale (e.g. Sunday for `en-US`, Monday for `en-GB`).
     *
     * Uses local time throughout — consistent with `Badger.startOf("week")` and
     * the `.dayOfWeek` getter. In non-UTC timezones this gives the correct local
     * calendar day, whereas a UTC-based calculation would return the wrong week
     * for dates near midnight.
     */
    startOfWeek(): Date {
        this.assertDateValid("startOfWeek");
        const locObj = new Intl.Locale(this.resolvedOptions().locale);
        /* v8 ignore next 1 */
        const firstDay: number = (locObj as any).weekInfo?.firstDay ?? 1;
        // weekInfo firstDay: 1=Mon…7=Sun → JS: Sun=0, else same as ISO
        const jsFirstDay = firstDay === 7 ? 0 : firstDay;
        const jsDay = this.currentDate.getDay();          // local day of week
        const daysBack = (jsDay - jsFirstDay + 7) % 7;
        const result = new Date(this.currentDate);
        result.setDate(result.getDate() - daysBack);      // local date stepping
        result.setHours(0, 0, 0, 0);                      // local midnight
        return result;
    }

    /**
     * Convenience method — calls `countdown()` on the given `Badger` date and
     * formats the result with `Intl.DurationFormat` in the configured locale.
     * Returns `null` if the date is in the past or equal to now.
     *
     * Requires `Intl.DurationFormat` (Node ≥ 24, Chrome 127+, Firefox 127+, Safari 17.4+).
     *
     * @example
     * ```ts
     * Sett(new Date(), new Intl.Locale("en-GB")).formatCountdown(new Date("2026-12-25"))
     * // "206 days, 3 hours, 14 minutes, and 22 seconds"  — or null if past
     * ```
     */
    /* v8 ignore next 6 — Intl.DurationFormat only available in Node 24+; covered by CI */
    formatCountdown(target: Date): string | null {
        const remaining = new Badger(target).countdown(this.currentDate);
        if (!remaining) return null;
        return this.formatDuration(remaining);
    }

    /* v8 ignore next 8 — Intl.DurationFormat only available in Node 24+; covered by CI */
    formatDuration(duration: Record<string, number>): string {
        const DurationFormat = (Intl as any).DurationFormat;
        if (!DurationFormat) {
            throw new Error("Intl.DurationFormat is not supported in this environment");
        }
        return new DurationFormat(this.resolvedOptions().locale, { style: "long" }).format(duration);
    }

    /** Returns a human-readable relative time string (e.g. `"3 hours ago"`, `"in 2 days"`).
     *  Optionally pass `relativeTo` to anchor the comparison to a specific date instead of now.
     *  Month and year thresholds are calendar-based, not approximated. */
    formatRelative(relativeTo?: Date): string {
        const now = relativeTo ?? new Date();
        if (isNaN(this.currentDate.getTime())) throw new RangeError("formatRelative: currentDate is not a valid date");
        if (isNaN(now.getTime())) throw new RangeError("formatRelative: relativeTo is not a valid date");
        const diffMs = now.getTime() - this.currentDate.getTime();
        const absDiffMs = Math.abs(diffMs);
        const isFuture = diffMs < 0;

        const seconds = Math.floor(absDiffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);

        const earlier = isFuture ? now : this.currentDate;
        const later = isFuture ? this.currentDate : now;
        const calMonths =
            (later.getFullYear() - earlier.getFullYear()) * 12 +
            (later.getMonth() - earlier.getMonth());
        const calYears = Math.floor(calMonths / 12);

        let value: number;
        let unit: Intl.RelativeTimeFormatUnit;

        if (seconds < 60) {
            value = seconds;
            unit = "second";
        } else if (minutes < 60) {
            value = minutes;
            unit = "minute";
        } else if (hours < 24) {
            value = hours;
            unit = "hour";
        } else if (days < 7) {
            value = days;
            unit = "day";
        } else if (days < 28 || calMonths < 1) {
            value = weeks;
            unit = "week";
        } else if (calMonths < 12) {
            value = calMonths;
            unit = "month";
        } else {
            value = calYears;
            unit = "year";
        }

        const rtf = new Intl.RelativeTimeFormat(this.resolvedOptions().locale, {
            numeric: "auto"
        });
        return rtf.format(isFuture ? value : -value, unit);
    }
}
