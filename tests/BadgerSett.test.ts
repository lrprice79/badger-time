import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadgerSett, BadgerZone } from "../src/BadgerSett";

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

// ─── BadgerZone ───────────────────────────────────────────────────────────────

describe("BadgerZone enum", () => {
    it("en-GB → Europe/London", () => expect(BadgerZone["en-GB"]).toBe("Europe/London"));
    it("sv-SE → Europe/Stockholm", () => expect(BadgerZone["sv-SE"]).toBe("Europe/Stockholm"));
    it("fi-FI → Europe/Helsinki", () => expect(BadgerZone["fi-FI"]).toBe("Europe/Helsinki"));
    it("da-DK → Europe/Copenhagen", () => expect(BadgerZone["da-DK"]).toBe("Europe/Copenhagen"));
    it("de-DE → Europe/Berlin", () => expect(BadgerZone["de-DE"]).toBe("Europe/Berlin"));
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
    it("returns HH:MM:SS format (24-hour)", () => {
        const bs = new BadgerSett("2026-06-15T14:30:45Z");
        const result = bs.formatTimeOnly();
        expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it("UTC time is offset to BST — 14:30 UTC displays as 15:30 in London summer", () => {
        const bs = new BadgerSett("2026-06-15T14:30:00Z");
        expect(bs.formatTimeOnly()).toContain("15");
    });

    it("24-hour format — 23:00 does not display as 11:00", () => {
        const bs = new BadgerSett("2026-06-15T22:00:00Z"); // 23:00 BST
        expect(bs.formatTimeOnly()).toContain("23");
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
