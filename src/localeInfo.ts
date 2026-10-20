// Locale helpers that work on engines WITHOUT `Intl.Locale` (Hermes, React Native's engine).
// Everything that needs week info or a locale tag goes through here, so a missing Intl.Locale
// degrades to sensible defaults (en-GB, Monday-first, Sat+Sun weekend) instead of throwing
// "undefined cannot be used as a constructor".

import { BadgerSettings } from "./BadgerSettings";

/** A locale as an `Intl.Locale` or a plain BCP 47 tag (e.g. `"sv-SE"`). */
export type LocaleInput = Intl.Locale | string;

const FALLBACK_TAG = "en-GB";

/** The BCP 47 tag for `locale`, falling back to `BadgerSettings.defaultLocale`, then `"en-GB"`. */
export function localeTag(locale?: LocaleInput): string {
    const resolved = locale ?? BadgerSettings.defaultLocale;
    if (resolved === undefined) return FALLBACK_TAG;
    return typeof resolved === "string" ? resolved : resolved.baseName;
}

/** `weekInfo` for a locale, or undefined when Intl.Locale / weekInfo is unavailable or the tag is bad. */
function weekInfo(locale?: LocaleInput): { firstDay?: number; weekend?: number[] } | undefined {
    const resolved = locale ?? BadgerSettings.defaultLocale;
    if (resolved === undefined) return undefined;
    try {
        const obj: any = typeof resolved === "string"
            ? new (Intl as any).Locale(resolved)
            : resolved;
        return obj.weekInfo ?? obj.getWeekInfo?.();
    } catch {
        return undefined; // no Intl.Locale (Hermes) or an invalid tag
    }
}

/** ISO first day of the week (1 = Monday … 7 = Sunday). Defaults to Monday. */
export function firstDayOfWeek(locale?: LocaleInput): number {
    const day = weekInfo(locale)?.firstDay;
    return typeof day === "number" ? day : 1;
}

/** ISO weekend days (1 = Monday … 7 = Sunday). Defaults to Saturday + Sunday. */
export function weekendDays(locale?: LocaleInput): number[] {
    const weekend = weekInfo(locale)?.weekend;
    return Array.isArray(weekend) ? weekend : [6, 7];
}

/** Whether the locale's default clock is 12-hour, read from Intl.DateTimeFormat (no Intl.Locale). */
export function uses12HourClock(locale: string): boolean {
    const opts = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions() as Intl.ResolvedDateTimeFormatOptions & { hourCycle?: string };
    if (opts.hourCycle) return opts.hourCycle === "h11" || opts.hourCycle === "h12";
    // Some engines report hour12 but not hourCycle.
    return opts.hour12 === true;
}
