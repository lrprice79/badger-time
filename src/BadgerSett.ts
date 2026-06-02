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
        this.currentDate = date ? new Date(date) : new Date();
    }

    /** Returns the date as a UTC ISO 8601 string (e.g. `"2026-03-15T09:30:45.000Z"`), suitable for backend APIs. */
    formatForBackend(): string {
        return this.currentDate.toISOString();
    }

    /**
     * Returns a UTC ISO string representing midnight (00:00:00) in the configured timezone.
     * Does not mutate `currentDate`.
     */
    formatForBackendToStartOfDay(): string {
        return this.toUtcIsoAtTimeInTimezone(0, 0, 0, 0);
    }

    /**
     * Returns a UTC ISO string representing end-of-day (23:59:59.999) in the configured timezone.
     * Does not mutate `currentDate`.
     */
    formatForBackendToEndOfDay(): string {
        return this.toUtcIsoAtTimeInTimezone(23, 59, 59, 999);
    }

    /**
     * Computes the UTC instant for a specific time-of-day in the configured timezone
     * on the same calendar date as `currentDate` (in that timezone).
     */
    private toUtcIsoAtTimeInTimezone(hours: number, minutes: number, seconds: number, ms: number): string {
        const tz = this.resolvedOptions().timeZone;

        // Extract the calendar date as it appears in the configured timezone
        const parts = new Intl.DateTimeFormat("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: tz
        }).formatToParts(this.currentDate);

        const year = parts.find(p => p.type === "year")!.value;
        const month = parts.find(p => p.type === "month")!.value;
        const day = parts.find(p => p.type === "day")!.value;

        const h = String(hours).padStart(2, "0");
        const m = String(minutes).padStart(2, "0");
        const s = String(seconds).padStart(2, "0");
        const msStr = String(ms).padStart(3, "0");
        const localIso = `${year}-${month}-${day}T${h}:${m}:${s}.${msStr}`;

        // Find the UTC instant that corresponds to this local time in the target timezone.
        // Start with a UTC guess, then compute the offset and adjust.
        const utcGuess = new Date(localIso + "Z");
        const offset = this.getTimezoneOffsetMs(utcGuess, tz);
        const adjusted = new Date(utcGuess.getTime() + offset);

        // Verify: the offset may have changed (DST boundary). Re-check and adjust if needed.
        const offset2 = this.getTimezoneOffsetMs(adjusted, tz);
        /* v8 ignore next 3 — fires only for timezones that spring forward at midnight */
        if (offset !== offset2) {
            return new Date(utcGuess.getTime() + offset2).toISOString();
        }
        return adjusted.toISOString();
    }

    /**
     * Returns the offset in ms to convert UTC to a given timezone.
     * Positive = timezone is behind UTC, negative = timezone is ahead of UTC.
     */
    private getTimezoneOffsetMs(date: Date, tz: string): number {
        const toMs = (timeZone: string) => {
            const p = new Intl.DateTimeFormat("en-GB", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone
            }).formatToParts(date);
            const get = (type: string) => Number(p.find(x => x.type === type)!.value);
            return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
        };
        return toMs("UTC") - toMs(tz);
    }

    /** Formats the full date and time using the configured locale and options. */
    formatDate() {
        return this.format(this.currentDate);
    }

    /** Formats only the date portion (year, month, day) without time. */
    formatDateOnly() {
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
        return new Intl.DateTimeFormat(this.resolvedOptions().locale, {
            weekday: format
        }).format(this.currentDate);
    }

    /** Returns the localised month name (e.g. `"March"`, `"Mar"`, `"M"`). */
    getMonthName(format: Month = "long") {
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
        // JS getUTCDay: 0=Sun…6=Sat → ISO: Sun=7, else same
        const jsDay = this.currentDate.getUTCDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        return weekend.includes(isoDay);
    }

    /**
     * Returns a new `Date` at UTC midnight of the first day of the week
     * for the configured locale (e.g. Sunday for `en-US`, Monday for `en-GB`).
     */
    startOfWeek(): Date {
        const locObj = new Intl.Locale(this.resolvedOptions().locale);
        /* v8 ignore next 1 */
        const firstDay: number = (locObj as any).weekInfo?.firstDay ?? 1;
        // weekInfo firstDay: 1=Mon…7=Sun → JS: Sun=0, else same as ISO
        const jsFirstDay = firstDay === 7 ? 0 : firstDay;
        const jsDay = this.currentDate.getUTCDay();
        const daysBack = (jsDay - jsFirstDay + 7) % 7;
        const result = new Date(this.currentDate);
        result.setUTCDate(result.getUTCDate() - daysBack);
        result.setUTCHours(0, 0, 0, 0);
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
     * Sett(new Date(), new Intl.Locale("en-GB")).formatCountdown(Badger("2026-12-25"))
     * // "206 days, 3 hours, 14 minutes, and 22 seconds"  — or null if past
     * ```
     */
    /* v8 ignore next 6 — Intl.DurationFormat only available in Node 24+; covered by CI */
    formatCountdown(target: Badger): string | null {
        const remaining = target.countdown(this.currentDate);
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
        } else if (calMonths < 1) {
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
