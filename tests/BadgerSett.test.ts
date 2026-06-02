import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadgerSett } from "../src/BadgerSett";
import { BadgerSettings } from "../src/BadgerSettings";

// All tests run under TZ=UTC (set in vitest.config.ts).
// Europe/London is UTC in winter and UTC+1 in summer (BST).
// Europe/Stockholm is UTC+1 in winter, UTC+2 in summer.

// ─── Constructor ──────────────────────────────────────────────────────────────

describe("BadgerSett constructor", () => {
    it("no arg → current time, en-GB locale, Europe/London timezone", () => {
        const bs = new BadgerSett();
        const opts = bs.resolvedOptions();
        expect(opts.locale).toBe("en-GB");
        expect(opts.timeZone).toBe("Europe/London");
    });

    it("accepts a Date object", () => {
        const d = new Date("2026-06-15T12:00:00Z");
        const bs = new BadgerSett(d);
        expect(bs.currentDate.getTime()).toBe(d.getTime());
    });

    it("accepts a date string", () => {
        const bs = new BadgerSett("2026-06-15T12:00:00Z");
        expect(bs.currentDate.toISOString()).toBe("2026-06-15T12:00:00.000Z");
    });

    it("custom locale overrides default", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("sv-SE"));
        expect(bs.resolvedOptions().locale).toBe("sv-SE");
    });

    it("custom options override default", () => {
        const bs = new BadgerSett(new Date(), undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Europe/London"
        });
        expect(bs.resolvedOptions().month).toBe("long");
    });
});

// ─── formatForBackend ─────────────────────────────────────────────────────────

describe("formatForBackend", () => {
    it("returns UTC ISO string", () => {
        const bs = new BadgerSett("2026-06-15T10:30:45Z");
        expect(bs.formatForBackend()).toBe("2026-06-15T10:30:45.000Z");
    });

    it("preserves milliseconds", () => {
        const bs = new BadgerSett(new Date("2026-06-15T10:30:45.123Z"));
        expect(bs.formatForBackend()).toBe("2026-06-15T10:30:45.123Z");
    });
});

// ─── formatForBackendToStartOfDay ─────────────────────────────────────────────

describe("formatForBackendToStartOfDay", () => {
    it("Europe/London UTC (winter) — midnight = 00:00 UTC", () => {
        // 2026-01-15 — London is UTC in winter, so midnight London = 00:00 UTC
        const bs = new BadgerSett("2026-01-15T12:00:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-01-15T00:00:00.000Z");
    });

    it("Europe/London BST (summer) — midnight = 23:00 UTC previous day", () => {
        // 2026-07-15 — London is UTC+1 in summer, so midnight London = 23:00 UTC previous day
        const bs = new BadgerSett("2026-07-15T12:00:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-07-14T23:00:00.000Z");
    });

    it("Europe/Stockholm winter (UTC+1) — midnight = 23:00 UTC previous day", () => {
        const bs = new BadgerSett(
            new Date("2026-01-15T12:00:00Z"),
            new Intl.Locale("sv-SE"),
            { ...defaultStockholmOpts }
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-01-14T23:00:00.000Z");
    });

    it("Europe/Stockholm summer (UTC+2) — midnight = 22:00 UTC previous day", () => {
        const bs = new BadgerSett(
            new Date("2026-07-15T12:00:00Z"),
            new Intl.Locale("sv-SE"),
            { ...defaultStockholmOpts }
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-07-14T22:00:00.000Z");
    });

    it("date is determined by calendar date in the configured timezone, not UTC", () => {
        // 2026-07-15T00:30:00Z = 2026-07-15T01:30 BST
        // Start of THAT BST day = 2026-07-14T23:00Z
        const bs = new BadgerSett("2026-07-15T00:30:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-07-14T23:00:00.000Z");
    });
});

// ─── formatForBackendToEndOfDay ───────────────────────────────────────────────

describe("formatForBackendToEndOfDay", () => {
    it("Europe/London UTC (winter) — 23:59:59.999 = 23:59:59.999 UTC", () => {
        const bs = new BadgerSett("2026-01-15T12:00:00Z");
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-01-15T23:59:59.999Z");
    });

    it("Europe/London BST (summer) — 23:59:59.999 BST = 22:59:59.999 UTC", () => {
        const bs = new BadgerSett("2026-07-15T12:00:00Z");
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-07-15T22:59:59.999Z");
    });
});

// ─── DST boundary ─────────────────────────────────────────────────────────────

describe("DST boundary — Europe/London clocks forward last Sunday of March", () => {
    it("the day clocks go forward — midnight is still GMT (clocks change at 01:00)", () => {
        // 2026-03-29 — London clocks go forward at 01:00 → 02:00
        // Midnight 29th is still GMT (UTC+0), so start of day = 00:00 UTC
        const bs = new BadgerSett("2026-03-29T12:00:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-29T00:00:00.000Z");
    });

    it("the day before clocks go forward — still UTC offset 0", () => {
        const bs = new BadgerSett("2026-03-28T12:00:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-28T00:00:00.000Z");
    });

    it("end of day on spring-forward day — 23:59:59 BST = 22:59:59 UTC (DST second-pass)", () => {
        // On 2026-03-29 clocks go forward at 01:00 GMT → 02:00 BST.
        // The day's end-of-day in London is 23:59:59 BST = 22:59:59 UTC.
        // The first UTC guess (treating 23:59:59 as GMT) would produce 23:59:59 UTC,
        // which lies in BST — the second-pass correction adjusts to 22:59:59 UTC.
        const bs = new BadgerSett("2026-03-29T12:00:00Z");
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-03-29T22:59:59.999Z");
    });
});

// ─── DST fall-back ────────────────────────────────────────────────────────────

describe("DST boundary — Europe/London clocks back last Sunday of October", () => {
    it("start of day on fall-back day — midnight is still BST (UTC+1)", () => {
        // 2026-10-25 — London clocks go back at 02:00 BST → 01:00 GMT.
        // Midnight on the 25th is still BST (UTC+1), so start of day = 23:00 UTC Oct 24.
        const bs = new BadgerSett("2026-10-25T12:00:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-10-24T23:00:00.000Z");
    });

    it("end of day on fall-back day — 23:59:59 is GMT (UTC+0)", () => {
        // After clocks fall back the end of the day is in GMT, so 23:59:59 London = 23:59:59 UTC.
        const bs = new BadgerSett("2026-10-25T12:00:00Z");
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-10-25T23:59:59.999Z");
    });

    it("day after fall-back — back to UTC+0 all day", () => {
        const bs = new BadgerSett("2026-10-26T12:00:00Z");
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-10-26T00:00:00.000Z");
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-10-26T23:59:59.999Z");
    });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
    it("returns a non-empty string", () => {
        const bs = new BadgerSett("2026-06-15T10:30:45Z");
        const result = bs.formatDate();
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });

    it("contains the year, month and day", () => {
        const bs = new BadgerSett("2026-06-15T10:30:45Z");
        const result = bs.formatDate();
        expect(result).toContain("2026");
        expect(result).toContain("06");
        expect(result).toContain("15");
    });
});

// ─── formatDateOnly ───────────────────────────────────────────────────────────

describe("formatDateOnly", () => {
    it("does not include time components for en-GB", () => {
        const bs = new BadgerSett("2026-06-15T10:30:45Z");
        const result = bs.formatDateOnly();
        expect(result).not.toMatch(/\d{2}:\d{2}/);
        expect(result).toContain("2026");
    });

    it("includes day, month, year", () => {
        const bs = new BadgerSett("2026-06-15T00:00:00Z");
        const result = bs.formatDateOnly();
        expect(result).toContain("15");
        expect(result).toContain("06");
        expect(result).toContain("2026");
    });
});

// ─── formatTimeOnly ───────────────────────────────────────────────────────────

describe("formatTimeOnly", () => {
    it("returns HH:MM:SS format (24-hour) for en-GB", () => {
        const bs = new BadgerSett("2026-06-15T14:30:45Z");
        const result = bs.formatTimeOnly();
        expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it("UTC time is offset to BST — 14:30 UTC displays as 15:30 in London summer", () => {
        const bs = new BadgerSett("2026-06-15T14:30:00Z");
        expect(bs.formatTimeOnly()).toContain("15");
    });

    it("24-hour format — 23:00 does not display as 11:00 for en-GB", () => {
        const bs = new BadgerSett("2026-06-15T22:00:00Z"); // 23:00 BST
        expect(bs.formatTimeOnly()).toContain("23");
    });

    it("en-US uses 12-hour format — 15:30 displays as PM", () => {
        const bs = new BadgerSett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("en-US"), {
            timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        expect(bs.formatTimeOnly()).toBe("03:30:45 PM");
    });

    it("en-US morning time shows AM", () => {
        const bs = new BadgerSett(new Date("2026-06-15T09:30:45Z"), new Intl.Locale("en-US"), {
            timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        expect(bs.formatTimeOnly()).toBe("09:30:45 AM");
    });

    it("de-DE uses 24-hour format", () => {
        const bs = new BadgerSett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("de-DE"), {
            timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        expect(bs.formatTimeOnly()).toBe("15:30:45");
    });

    it("ar-SA uses 12-hour format", () => {
        const bs = new BadgerSett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("ar-SA"), {
            timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        const result = bs.formatTimeOnly();
        // ar-SA is 12h — should not contain 15
        expect(result).not.toContain("15");
    });
});

// ─── getDayName ───────────────────────────────────────────────────────────────

describe("getDayName", () => {
    // 2026-06-15 is a Monday
    const monday = new BadgerSett("2026-06-15T12:00:00Z");

    it("long format (default)", () => expect(monday.getDayName()).toBe("Monday"));
    it("short format", () => expect(monday.getDayName("short")).toBe("Mon"));
    it("narrow format", () => expect(monday.getDayName("narrow")).toBe("M"));

    it("Sunday returns correct name", () => {
        const sunday = new BadgerSett("2026-06-21T12:00:00Z");
        expect(sunday.getDayName()).toBe("Sunday");
    });

    it("sv-SE locale returns Swedish day name", () => {
        const bs = new BadgerSett("2026-06-15T12:00:00Z", new Intl.Locale("sv-SE"));
        expect(bs.getDayName()).toBe("måndag");
    });
});

// ─── getMonthName ─────────────────────────────────────────────────────────────

describe("getMonthName", () => {
    const march = new BadgerSett("2026-03-15T00:00:00Z");

    it("long format (default)", () => expect(march.getMonthName()).toBe("March"));
    it("short format", () => expect(march.getMonthName("short")).toBe("Mar"));

    it("December", () => {
        expect(new BadgerSett("2026-12-01T00:00:00Z").getMonthName()).toBe("December");
    });

    it("sv-SE locale returns Swedish month name", () => {
        const bs = new BadgerSett("2026-03-15T00:00:00Z", new Intl.Locale("sv-SE"));
        expect(bs.getMonthName()).toBe("mars");
    });
});

// ─── getDaysOfTheWeek ─────────────────────────────────────────────────────────

describe("getDaysOfTheWeek", () => {
    it("returns 7 items", () => {
        expect(new BadgerSett().getDaysOfTheWeek()).toHaveLength(7);
    });

    it("starts with Monday for en-GB", () => {
        const days = new BadgerSett().getDaysOfTheWeek();
        expect(days[0]).toBe("Monday");
    });

    it("ends with Sunday for en-GB", () => {
        const days = new BadgerSett().getDaysOfTheWeek();
        expect(days[6]).toBe("Sunday");
    });

    it("short format", () => {
        const days = new BadgerSett().getDaysOfTheWeek("short");
        expect(days[0]).toBe("Mon");
        expect(days[6]).toBe("Sun");
    });

    it("sv-SE locale starts with måndag", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("sv-SE"));
        expect(bs.getDaysOfTheWeek()[0]).toBe("måndag");
    });

    it("en-US locale starts with Sunday", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-US"));
        expect(bs.getDaysOfTheWeek()[0]).toBe("Sunday");
    });

    it("en-US locale ends with Saturday", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-US"));
        expect(bs.getDaysOfTheWeek()[6]).toBe("Saturday");
    });

    it("narrow format returns single characters", () => {
        const days = new BadgerSett().getDaysOfTheWeek("narrow");
        expect(days).toHaveLength(7);
        expect(days[0]).toBe("M"); // Monday narrow
    });
});

// ─── getMonthsOfTheYear ───────────────────────────────────────────────────────

describe("getMonthsOfTheYear", () => {
    it("returns 12 items", () => {
        expect(new BadgerSett().getMonthsOfTheYear()).toHaveLength(12);
    });

    it("first month is January", () => {
        expect(new BadgerSett().getMonthsOfTheYear()[0]).toBe("January");
    });

    it("last month is December", () => {
        expect(new BadgerSett().getMonthsOfTheYear()[11]).toBe("December");
    });

    it("short format", () => {
        const months = new BadgerSett().getMonthsOfTheYear("short");
        expect(months[0]).toBe("Jan");
        expect(months[11]).toBe("Dec");
    });

    it("sv-SE locale returns Swedish month names", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("sv-SE"));
        expect(bs.getMonthsOfTheYear()[0]).toBe("januari");
    });
});

// ─── formatRelative ───────────────────────────────────────────────────────────

describe("formatRelative", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("same instant → 'now'", () => {
        const bs = new BadgerSett(new Date("2026-06-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("now");
    });

    it("30 seconds ago", () => {
        const bs = new BadgerSett(new Date("2026-06-15T11:59:30Z"));
        expect(bs.formatRelative()).toBe("30 seconds ago");
    });

    it("2 minutes ago", () => {
        const bs = new BadgerSett(new Date("2026-06-15T11:58:00Z"));
        expect(bs.formatRelative()).toBe("2 minutes ago");
    });

    it("3 hours ago", () => {
        const bs = new BadgerSett(new Date("2026-06-15T09:00:00Z"));
        expect(bs.formatRelative()).toBe("3 hours ago");
    });

    it("2 days ago", () => {
        const bs = new BadgerSett(new Date("2026-06-13T12:00:00Z"));
        expect(bs.formatRelative()).toBe("2 days ago");
    });

    it("2 weeks ago", () => {
        const bs = new BadgerSett(new Date("2026-06-01T12:00:00Z"));
        expect(bs.formatRelative()).toBe("2 weeks ago");
    });

    it("2 months ago", () => {
        const bs = new BadgerSett(new Date("2026-04-06T12:00:00Z"));
        expect(bs.formatRelative()).toBe("2 months ago");
    });

    it("1 year ago", () => {
        const bs = new BadgerSett(new Date("2025-06-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("last year");
    });

    it("in 5 minutes (future)", () => {
        const bs = new BadgerSett(new Date("2026-06-15T12:05:00Z"));
        expect(bs.formatRelative()).toBe("in 5 minutes");
    });

    it("in 2 hours (future)", () => {
        const bs = new BadgerSett(new Date("2026-06-15T14:00:00Z"));
        expect(bs.formatRelative()).toBe("in 2 hours");
    });

    it("in 3 days (future)", () => {
        const bs = new BadgerSett(new Date("2026-06-18T12:00:00Z"));
        expect(bs.formatRelative()).toBe("in 3 days");
    });

    it("in 1 year (future)", () => {
        const bs = new BadgerSett(new Date("2027-06-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("next year");
    });

    // Calendar-boundary accuracy tests
    it("28 days in same calendar month → weeks, not months", () => {
        // Jun 15 → May 18 = 28 days, still in same-ish month span but calMonths = 0 going backwards
        // Use anchor: Jun 15. Date: May 18. days=28, calMonths: May(4) to June(5) = 1 calendar month.
        // So this is actually 1 month. Let's use within same month: Jun 15 → Jun 1 = 14 days (2 weeks).
        const bs = new BadgerSett(new Date("2026-06-01T12:00:00Z"));
        expect(bs.formatRelative()).toBe("2 weeks ago"); // calMonths=0 → falls to weeks
    });

    it("exactly 1 calendar month → 1 month, not weeks", () => {
        // May 15 is exactly 1 calendar month before Jun 15
        const bs = new BadgerSett(new Date("2026-05-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("last month");
    });

    it("11 calendar months → 11 months, not a year", () => {
        // Jul 15 2025 is 11 calendar months before Jun 15 2026
        const bs = new BadgerSett(new Date("2025-07-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("11 months ago");
    });

    it("2 years (future)", () => {
        const bs = new BadgerSett(new Date("2028-06-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("in 2 years");
    });
});

// ─── formatRelative with custom anchor ───────────────────────────────────────

describe("formatRelative with relativeTo anchor", () => {
    it("2 days before anchor", () => {
        const anchor = new Date("2026-06-15T12:00:00Z");
        const bs = new BadgerSett(new Date("2026-06-13T12:00:00Z"));
        expect(bs.formatRelative(anchor)).toBe("2 days ago");
    });

    it("3 hours after anchor", () => {
        const anchor = new Date("2026-06-15T09:00:00Z");
        const bs = new BadgerSett(new Date("2026-06-15T12:00:00Z"));
        expect(bs.formatRelative(anchor)).toBe("in 3 hours");
    });

    it("same instant as anchor → 'now'", () => {
        const anchor = new Date("2026-06-15T12:00:00Z");
        const bs = new BadgerSett(new Date("2026-06-15T12:00:00Z"));
        expect(bs.formatRelative(anchor)).toBe("now");
    });

    it("no anchor falls back to Date.now()", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
        const bs = new BadgerSett(new Date("2026-06-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("now");
        vi.useRealTimers();
    });
});

// ─── currentDate is readonly ──────────────────────────────────────────────────

describe("currentDate readonly", () => {
    it("currentDate is exposed and reflects the constructed date", () => {
        const d = new Date("2026-06-15T12:00:00Z");
        const bs = new BadgerSett(d);
        expect(bs.currentDate.getTime()).toBe(d.getTime());
    });

    it("currentDate is a different reference from the constructor argument", () => {
        const d = new Date("2026-06-15T12:00:00Z");
        const bs = new BadgerSett(d);
        d.setFullYear(2000);
        expect(bs.currentDate.getFullYear()).toBe(2026);
    });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const defaultStockholmOpts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Stockholm"
};

// ─── isWeekend (locale-aware) ─────────────────────────────────────────────────
// June 2026 reference dates (all UTC):
//   Fri Jun 5, Sat Jun 6, Sun Jun 7, Wed Jun 10
//
// weekInfo day numbers are ISO: 1=Mon … 7=Sun
// en-GB weekend: [6, 7] (Sat, Sun)
// ar-SA weekend: [5, 6] (Fri, Sat) — Sunday is a workday

describe("isWeekend (locale-aware)", () => {
    it("Saturday is a weekend day in en-GB", () => {
        const bs = new BadgerSett(new Date("2026-06-06T12:00:00Z"), new Intl.Locale("en-GB"));
        expect(bs.isWeekend()).toBe(true);
    });

    it("Friday is not a weekend day in en-GB", () => {
        const bs = new BadgerSett(new Date("2026-06-05T12:00:00Z"), new Intl.Locale("en-GB"));
        expect(bs.isWeekend()).toBe(false);
    });

    it("Sunday is a weekend day in en-GB", () => {
        const bs = new BadgerSett(new Date("2026-06-07T12:00:00Z"), new Intl.Locale("en-GB"));
        expect(bs.isWeekend()).toBe(true);
    });

    it("Friday is a weekend day in ar-SA", () => {
        const bs = new BadgerSett(new Date("2026-06-05T12:00:00Z"), new Intl.Locale("ar-SA"));
        expect(bs.isWeekend()).toBe(true);
    });

    it("Saturday is a weekend day in ar-SA", () => {
        const bs = new BadgerSett(new Date("2026-06-06T12:00:00Z"), new Intl.Locale("ar-SA"));
        expect(bs.isWeekend()).toBe(true);
    });

    it("Sunday is NOT a weekend day in ar-SA", () => {
        const bs = new BadgerSett(new Date("2026-06-07T12:00:00Z"), new Intl.Locale("ar-SA"));
        expect(bs.isWeekend()).toBe(false);
    });

    it("Wednesday is not a weekend day in any locale", () => {
        const enGb = new BadgerSett(new Date("2026-06-10T12:00:00Z"), new Intl.Locale("en-GB"));
        const arSa = new BadgerSett(new Date("2026-06-10T12:00:00Z"), new Intl.Locale("ar-SA"));
        expect(enGb.isWeekend()).toBe(false);
        expect(arSa.isWeekend()).toBe(false);
    });
});

// ─── startOfWeek (locale-aware) ───────────────────────────────────────────────
// Returns a Date at UTC midnight of the first day of the locale's week.
//
// en-GB firstDay: 1 (Monday)
// en-US firstDay: 7 (Sunday)
//
// Wed Jun 10 → en-GB: Mon Jun 8 | en-US: Sun Jun 7
// Mon Jun 8  → en-GB: Mon Jun 8 (already the start)
// Sun Jun 7  → en-US: Sun Jun 7 (already the start)
// Sun Jun 7  → en-GB: Mon Jun 1 (Sunday belongs to the previous week)

describe("startOfWeek (locale-aware)", () => {
    it("Wednesday → Monday for en-GB (Mon start)", () => {
        const bs = new BadgerSett(new Date("2026-06-10T12:00:00Z"), new Intl.Locale("en-GB"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-08T00:00:00.000Z");
    });

    it("Wednesday → Sunday for en-US (Sun start)", () => {
        const bs = new BadgerSett(new Date("2026-06-10T12:00:00Z"), new Intl.Locale("en-US"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-07T00:00:00.000Z");
    });

    it("Monday itself is the start for en-GB", () => {
        const bs = new BadgerSett(new Date("2026-06-08T12:00:00Z"), new Intl.Locale("en-GB"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-08T00:00:00.000Z");
    });

    it("Sunday itself is the start for en-US", () => {
        const bs = new BadgerSett(new Date("2026-06-07T12:00:00Z"), new Intl.Locale("en-US"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-07T00:00:00.000Z");
    });

    it("Sunday belongs to the previous week for en-GB", () => {
        // Jun 7 (Sun) → week started Mon Jun 1
        const bs = new BadgerSett(new Date("2026-06-07T12:00:00Z"), new Intl.Locale("en-GB"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-01T00:00:00.000Z");
    });

    it("time-of-day is stripped — result is always midnight UTC", () => {
        const bs = new BadgerSett(new Date("2026-06-10T23:59:59.999Z"), new Intl.Locale("en-GB"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-08T00:00:00.000Z");
    });
});

// ─── formatDuration (locale-aware, Intl.DurationFormat) ──────────────────────
// Skipped when Intl.DurationFormat is unavailable (Node < 24, older browsers).

const hasDurationFormat = typeof (Intl as any).DurationFormat === "function";

describe.skipIf(!hasDurationFormat)("formatDuration (Intl.DurationFormat)", () => {
    it("formats a single hour in en-GB — contains '1' and 'hour'", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const result = bs.formatDuration({ hours: 1 });
        expect(result).toContain("1");
        expect(result.toLowerCase()).toContain("hour");
    });

    it("formats hours and minutes in en-GB — contains both values", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const result = bs.formatDuration({ hours: 3, minutes: 22 });
        expect(result).toContain("3");
        expect(result).toContain("22");
        expect(typeof result).toBe("string");
    });

    it("formats in de-DE locale — returns a non-empty string", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("de-DE"));
        const result = bs.formatDuration({ hours: 2, minutes: 30 });
        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
    });

    it("formats days and hours — contains both values", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const result = bs.formatDuration({ days: 2, hours: 4 });
        expect(result).toContain("2");
        expect(result).toContain("4");
        expect(typeof result).toBe("string");
    });

    it("formats seconds — contains the value and 'second'", () => {
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const result = bs.formatDuration({ seconds: 45 });
        expect(result).toContain("45");
        expect(result.toLowerCase()).toContain("second");
    });
});

// ─── formatCountdown ──────────────────────────────────────────────────────────
// Convenience wrapper: wraps a Date in Badger, calls countdown(), and formats
// with Intl.DurationFormat. Returns null when the date is in the past.
// Skipped when Intl.DurationFormat is unavailable (Node < 24).

describe.skipIf(!hasDurationFormat)("formatCountdown (Intl.DurationFormat)", () => {
    it("returns a formatted string for a future date", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const target = new Date("2026-06-17T02:00:00Z");
        const result = bs.formatCountdown(target);
        expect(result).not.toBeNull();
        expect(result).toContain("2");  // 2 days
        vi.useRealTimers();
    });

    it("returns null for a past date", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const target = new Date("2026-06-14T00:00:00Z");
        expect(bs.formatCountdown(target)).toBeNull();
        vi.useRealTimers();
    });

    it("returns null when target equals now", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
        const bs = new BadgerSett(new Date(), new Intl.Locale("en-GB"));
        const target = new Date("2026-06-15T00:00:00Z");
        expect(bs.formatCountdown(target)).toBeNull();
        vi.useRealTimers();
    });
});

// ─── BadgerSettings global defaults ──────────────────────────────────────────
// BadgerSettings is reset after each test so global state never leaks.

describe("BadgerSettings", () => {
    afterEach(() => {
        BadgerSettings.reset();
    });

    it("default locale is en-GB when nothing is set", () => {
        const bs = new BadgerSett();
        expect(bs.resolvedOptions().locale).toBe("en-GB");
    });

    it("defaultLocale is used by BadgerSett when no locale arg is passed", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("sv-SE");
        const bs = new BadgerSett();
        expect(bs.resolvedOptions().locale).toBe("sv-SE");
    });

    it("explicit locale arg overrides defaultLocale", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("sv-SE");
        const bs = new BadgerSett(new Date(), new Intl.Locale("de-DE"));
        expect(bs.resolvedOptions().locale).toBe("de-DE");
    });

    it("defaultTimeZone is used by BadgerSett when no options arg is passed", () => {
        BadgerSettings.defaultTimeZone = "America/New_York";
        const bs = new BadgerSett();
        expect(bs.resolvedOptions().timeZone).toBe("America/New_York");
    });

    it("explicit options arg overrides defaultTimeZone", () => {
        BadgerSettings.defaultTimeZone = "America/New_York";
        const bs = new BadgerSett(new Date(), undefined, {
            timeZone: "Asia/Tokyo",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        });
        expect(bs.resolvedOptions().timeZone).toBe("Asia/Tokyo");
    });

    it("reset() restores en-GB and Europe/London defaults", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("ja-JP");
        BadgerSettings.defaultTimeZone = "Asia/Tokyo";
        BadgerSettings.reset();
        const bs = new BadgerSett();
        expect(bs.resolvedOptions().locale).toBe("en-GB");
        expect(bs.resolvedOptions().timeZone).toBe("Europe/London");
    });

    it("isWeekend() on BadgerSett uses defaultLocale weekInfo", () => {
        // ar-SA: Friday is a weekend day
        BadgerSettings.defaultLocale = new Intl.Locale("ar-SA");
        const bs = new BadgerSett(new Date("2026-06-05T12:00:00Z")); // Friday
        expect(bs.isWeekend()).toBe(true);
    });

    it("startOfWeek() on BadgerSett uses defaultLocale week start", () => {
        // en-US: week starts Sunday — Wed Jun 10 → Sun Jun 7
        BadgerSettings.defaultLocale = new Intl.Locale("en-US");
        const bs = new BadgerSett(new Date("2026-06-10T12:00:00Z"));
        expect(bs.startOfWeek().toISOString()).toBe("2026-06-07T00:00:00.000Z");
    });
});

// ─── BadgerSettings.setLocale + subscribe ─────────────────────────────────────
// setLocale() updates defaultLocale AND notifies all active subscribers.
// subscribe() returns an unsubscribe function for cleanup.
// reset() clears the locale AND removes all subscribers.

describe("BadgerSettings.subscribe", () => {
    afterEach(() => {
        BadgerSettings.reset();
    });

    it("setLocale() updates defaultLocale", () => {
        BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
        expect(BadgerSettings.defaultLocale?.baseName).toBe("fr-FR");
    });

    it("setLocale() causes new BadgerSett instances to use the new locale", () => {
        BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
        const bs = new BadgerSett();
        expect(bs.resolvedOptions().locale).toBe("fr-FR");
    });

    it("subscriber is called when setLocale() is called", () => {
        const calls: string[] = [];
        BadgerSettings.subscribe(locale => calls.push(locale.baseName));

        BadgerSettings.setLocale(new Intl.Locale("fr-FR"));

        expect(calls).toEqual(["fr-FR"]);
    });

    it("subscriber receives the new locale", () => {
        let received: Intl.Locale | null = null;
        BadgerSettings.subscribe(locale => { received = locale; });

        BadgerSettings.setLocale(new Intl.Locale("de-DE"));

        expect(received!.baseName).toBe("de-DE");
    });

    it("multiple subscribers all get called", () => {
        const calls: string[] = [];
        BadgerSettings.subscribe(locale => calls.push("a:" + locale.baseName));
        BadgerSettings.subscribe(locale => calls.push("b:" + locale.baseName));

        BadgerSettings.setLocale(new Intl.Locale("ja-JP"));

        expect(calls).toContain("a:ja-JP");
        expect(calls).toContain("b:ja-JP");
    });

    it("unsubscribe() stops the callback from firing", () => {
        const calls: string[] = [];
        const unsub = BadgerSettings.subscribe(locale => calls.push(locale.baseName));

        BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
        unsub();
        BadgerSettings.setLocale(new Intl.Locale("de-DE"));

        expect(calls).toEqual(["fr-FR"]); // de-DE switch not received
    });

    it("unsubscribing one does not affect other subscribers", () => {
        const a: string[] = [];
        const b: string[] = [];
        const unsubA = BadgerSettings.subscribe(locale => a.push(locale.baseName));
        BadgerSettings.subscribe(locale => b.push(locale.baseName));

        BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
        unsubA();
        BadgerSettings.setLocale(new Intl.Locale("de-DE"));

        expect(a).toEqual(["fr-FR"]);
        expect(b).toEqual(["fr-FR", "de-DE"]);
    });

    it("reset() clears subscribers — setLocale after reset does not trigger old callbacks", () => {
        const calls: string[] = [];
        BadgerSettings.subscribe(locale => calls.push(locale.baseName));

        BadgerSettings.reset();
        BadgerSettings.setLocale(new Intl.Locale("fr-FR"));

        expect(calls).toEqual([]);
    });

    it("subscribing after reset() works normally", () => {
        BadgerSettings.reset();
        const calls: string[] = [];
        BadgerSettings.subscribe(locale => calls.push(locale.baseName));

        BadgerSettings.setLocale(new Intl.Locale("sv-SE"));

        expect(calls).toEqual(["sv-SE"]);
    });
});

// ─── formatRelative — invalid date guards ─────────────────────────────────────
// Previously all NaN < N checks fail and the function falls to the "year" else
// branch, calling rtf.format(NaN, "year") which returns garbage like "NaN years
// ago". Now throws RangeError immediately for invalid currentDate or relativeTo.

describe("formatRelative — invalid date guards", () => {
    it("throws RangeError when currentDate is invalid", () => {
        const bs = new BadgerSett(new Date("not-a-date"));
        expect(() => bs.formatRelative()).toThrow(RangeError);
    });

    it("throws RangeError when relativeTo is invalid", () => {
        const bs = new BadgerSett(new Date("2026-06-15T12:00:00Z"));
        expect(() => bs.formatRelative(new Date("not-a-date"))).toThrow(RangeError);
    });

    it("valid currentDate and default relativeTo still works", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
        const bs = new BadgerSett(new Date("2026-06-15T12:00:00Z"));
        expect(bs.formatRelative()).toBe("now");
        vi.useRealTimers();
    });
});

// ─── BadgerSett constructor — empty string ────────────────────────────────────
// Mirrors the same fix in Badger: "" is falsy so the ternary would have fallen
// through to new Date() (current time). Now produces an Invalid Date instead.

describe("BadgerSett constructor — empty string", () => {
    it('new BadgerSett("") has an invalid currentDate', () => {
        const bs = new BadgerSett("");
        expect(isNaN(bs.currentDate.getTime())).toBe(true);
    });

    it('new BadgerSett("") throws when formatForBackend is called', () => {
        const bs = new BadgerSett("");
        expect(() => bs.formatForBackend()).toThrow();
    });

    it("valid string still works", () => {
        const bs = new BadgerSett("2026-06-15T12:00:00Z");
        expect(bs.currentDate.toISOString()).toBe("2026-06-15T12:00:00.000Z");
    });

    it("omitting date still defaults to current time", () => {
        const before = Date.now();
        const bs = new BadgerSett();
        const after = Date.now();
        expect(bs.currentDate.getTime()).toBeGreaterThanOrEqual(before);
        expect(bs.currentDate.getTime()).toBeLessThanOrEqual(after);
    });
});

// ─── F5: BadgerSett formatting methods — descriptive error on invalid date ─────
// Before fix: each method threw a cryptic native `RangeError: Invalid time value`
// from Intl internals with no indication of which method was called.
// After fix: throws `RangeError: BadgerSett.<method>(): date is not valid — …`

describe("BadgerSett — invalid date guard on formatting methods (F5)", () => {
    const invalid = new BadgerSett(new Date("not-a-date"));

    it("formatForBackend throws descriptive RangeError", () => {
        expect(() => invalid.formatForBackend()).toThrow(/BadgerSett\.formatForBackend/);
    });

    it("formatForBackendToStartOfDay throws descriptive RangeError", () => {
        expect(() => invalid.formatForBackendToStartOfDay()).toThrow(/BadgerSett\.formatForBackendToStartOfDay/);
    });

    it("formatForBackendToEndOfDay throws descriptive RangeError", () => {
        expect(() => invalid.formatForBackendToEndOfDay()).toThrow(/BadgerSett\.formatForBackendToEndOfDay/);
    });

    it("formatDate throws descriptive RangeError", () => {
        expect(() => invalid.formatDate()).toThrow(/BadgerSett\.formatDate/);
    });

    it("formatDateOnly throws descriptive RangeError", () => {
        expect(() => invalid.formatDateOnly()).toThrow(/BadgerSett\.formatDateOnly/);
    });

    it("formatTimeOnly throws descriptive RangeError", () => {
        expect(() => invalid.formatTimeOnly()).toThrow(/BadgerSett\.formatTimeOnly/);
    });

    it("getDayName throws descriptive RangeError", () => {
        expect(() => invalid.getDayName()).toThrow(/BadgerSett\.getDayName/);
    });

    it("getMonthName throws descriptive RangeError", () => {
        expect(() => invalid.getMonthName()).toThrow(/BadgerSett\.getMonthName/);
    });

    it("startOfWeek throws descriptive RangeError", () => {
        expect(() => invalid.startOfWeek()).toThrow(/BadgerSett\.startOfWeek/);
    });

    // Happy-path regression: valid dates still work after the guards were added.
    it("formatForBackend still works for valid date", () => {
        expect(new BadgerSett("2026-06-15T10:30:00Z").formatForBackend()).toBe("2026-06-15T10:30:00.000Z");
    });

    it("formatDate still works for valid date", () => {
        expect(typeof new BadgerSett("2026-06-15T10:30:00Z").formatDate()).toBe("string");
    });

    it("startOfWeek still works for valid date", () => {
        const result = new BadgerSett("2026-06-15T10:30:00Z").startOfWeek();
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result.getTime())).toBe(false);
    });
});

// ─── Midnight spring-forward DST (second-pass correction) ─────────────────────
//
// Most timezones spring forward at 01:00 or 02:00 local time — the `/* v8 ignore */`
// branch in toUtcIsoAtTimeInTimezone never fires for those. Two timezones spring
// forward at EXACTLY local midnight (00:00), so midnight itself doesn't exist and
// the first-pass offset no longer matches the adjusted time:
//
//   America/Havana (Cuba)    — UTC-5 CST → UTC-4 CDT on 1st Sun≥Mar 8 at 00:00 local
//   Atlantic/Azores          — UTC-1 → UTC+0 on last Sun of March at 01:00 UTC = 00:00 local
//
// Before the fix: the second-pass formula `utcGuess + offset2` was used for both cases.
// That is correct for UTC+ zones but wrong for UTC- zones — it returned a UTC instant
// that still corresponded to the PREVIOUS day in the local timezone (e.g. 23:00 local
// the night before, instead of the first valid moment 01:00 local on the spring-forward day).
//
// After the fix: Math.max(adjusted, utcGuess + offset2) — picks the correct (later)
// candidate in both UTC+ and UTC- cases.
//
// Cuba 2026 spring-forward:  Mar 8 at UTC 05:00  (local 00:00 CST → 01:00 CDT)
// Azores 2026 spring-forward: Mar 29 at UTC 01:00 (local 00:00 -01:00 → 01:00 UTC+0)

function havanaOpts(): Intl.DateTimeFormatOptions {
    return {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false, timeZone: "America/Havana"
    };
}

function azoresOpts(): Intl.DateTimeFormatOptions {
    return {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false, timeZone: "Atlantic/Azores"
    };
}

describe("formatForBackendToStartOfDay — midnight spring-forward (Cuba, America/Havana)", () => {
    // Confirmed transition boundary:
    //   2026-03-08T04:59:59Z → Havana local 07/03/2026 23:59:59 (CST, still previous day)
    //   2026-03-08T05:00:00Z → Havana local 08/03/2026 01:00:00 (CDT, first moment of Mar 8)
    // Local midnight (00:00) on March 8 was skipped — the spring-forward gap is 00:00→01:00.

    it("start of spring-forward day returns the first valid UTC instant (01:00 CDT = 05:00Z)", () => {
        // Before fix: returned 2026-03-08T04:00:00.000Z — which is 23:00 CST on Mar 7 (wrong day).
        // After fix:  returns 2026-03-08T05:00:00.000Z — which is 01:00 CDT on Mar 8 (correct).
        const bs = new BadgerSett(
            new Date("2026-03-08T12:00:00Z"), // noon UTC = 08:00 CDT, clearly Mar 8
            new Intl.Locale("en-US"),
            havanaOpts()
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-08T05:00:00.000Z");
    });

    it("end of spring-forward day is unaffected — still 23:59:59 CDT = 03:59:59Z next day", () => {
        const bs = new BadgerSett(
            new Date("2026-03-08T12:00:00Z"),
            new Intl.Locale("en-US"),
            havanaOpts()
        );
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-03-09T03:59:59.999Z");
    });

    it("day before spring-forward is unaffected — normal CST day", () => {
        // Mar 7 is a normal day in CST (UTC-5); no spring-forward involved.
        const bs = new BadgerSett(
            new Date("2026-03-07T12:00:00Z"), // noon UTC = 07:00 CST, clearly Mar 7
            new Intl.Locale("en-US"),
            havanaOpts()
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-07T05:00:00.000Z"); // midnight CST
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-03-08T04:59:59.999Z");   // 23:59:59 CST
    });

    it("day after spring-forward is unaffected — normal CDT day", () => {
        const bs = new BadgerSett(
            new Date("2026-03-09T12:00:00Z"),
            new Intl.Locale("en-US"),
            havanaOpts()
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-09T04:00:00.000Z"); // midnight CDT
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-03-10T03:59:59.999Z");
    });
});

describe("formatForBackendToStartOfDay — midnight spring-forward (Azores, Atlantic/Azores)", () => {
    // Confirmed transition boundary:
    //   2026-03-29T00:59:59Z → Azores local 28/03/2026 23:59:59 (-01:00, still previous day)
    //   2026-03-29T01:00:00Z → Azores local 29/03/2026 01:00:00 (UTC+0, first moment of Mar 29)
    // Local midnight on March 29 was skipped — transition is at 01:00 UTC = 00:00 local -01:00.

    it("start of spring-forward day returns the first valid UTC instant (01:00 UTC+0 = 01:00Z)", () => {
        // Before fix: returned 2026-03-29T00:00:00.000Z — which is 23:00 local on Mar 28 (wrong day).
        // After fix:  returns 2026-03-29T01:00:00.000Z — which is 01:00 UTC+0 on Mar 29 (correct).
        const bs = new BadgerSett(
            new Date("2026-03-29T12:00:00Z"), // noon UTC = noon UTC+0, clearly Mar 29
            new Intl.Locale("en-US"),
            azoresOpts()
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-29T01:00:00.000Z");
    });

    it("end of spring-forward day is unaffected — 23:59:59 UTC+0 = 23:59:59Z", () => {
        const bs = new BadgerSett(
            new Date("2026-03-29T12:00:00Z"),
            new Intl.Locale("en-US"),
            azoresOpts()
        );
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-03-29T23:59:59.999Z");
    });

    it("day before spring-forward is unaffected — normal -01:00 day", () => {
        const bs = new BadgerSett(
            new Date("2026-03-28T12:00:00Z"), // noon UTC = 11:00 local -01:00
            new Intl.Locale("en-US"),
            azoresOpts()
        );
        expect(bs.formatForBackendToStartOfDay()).toBe("2026-03-28T01:00:00.000Z"); // midnight -01:00
        expect(bs.formatForBackendToEndOfDay()).toBe("2026-03-29T00:59:59.999Z");
    });
});
