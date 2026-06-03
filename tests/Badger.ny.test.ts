/**
 * New York timezone tests for Badger (TZ=America/New_York).
 *
 * 2026 DST transitions in America/New_York:
 *   Spring forward — March 8 at 02:00 EST → 03:00 EDT  (23-hour day)
 *   Fall back      — November 1 at 02:00 EDT → 01:00 EST (25-hour day)
 *
 * All dates are constructed via Badger.fromLocal() so "local midnight"
 * means NY midnight, not UTC midnight.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Badger } from "../src/Badger";

// ─── dayOfYear ────────────────────────────────────────────────────────────────

describe("dayOfYear — New York", () => {
    it("Mar 8 noon (spring-forward day) → day 67", () => {
        // Jan(31)+Feb(28)+8 = 67
        expect(Badger.fromLocal("2026-03-08", "12:00").dayOfYear).toBe(67);
    });

    it("Mar 9 noon (first EDT day) → day 68", () => {
        expect(Badger.fromLocal("2026-03-09", "12:00").dayOfYear).toBe(68);
    });

    it("Nov 1 noon (fall-back day) → day 305", () => {
        // Jan(31)+Feb(28)+Mar(31)+Apr(30)+May(31)+Jun(30)+Jul(31)+Aug(31)+Sep(30)+Oct(31)+1 = 305
        expect(Badger.fromLocal("2026-11-01", "12:00").dayOfYear).toBe(305);
    });

    it("Jan 1 midnight → day 1", () => {
        expect(Badger.fromLocal("2026-01-01", "00:00").dayOfYear).toBe(1);
    });

    it("Dec 31 midnight (EST) → day 365", () => {
        expect(Badger.fromLocal("2026-12-31", "00:00").dayOfYear).toBe(365);
    });
});

// ─── diff("day") integer — across DST ────────────────────────────────────────

describe("diff day integer — New York", () => {
    it("Mar 7 → Mar 9 across spring-forward = 2 days", () => {
        const a = Badger.fromLocal("2026-03-09", "00:00");
        const b = Badger.fromLocal("2026-03-07", "00:00");
        expect(a.diff(b, "day")).toBe(2);
    });

    it("Mar 8 → Mar 9 (spring-forward day itself) = 1 day", () => {
        const a = Badger.fromLocal("2026-03-09", "00:00");
        const b = Badger.fromLocal("2026-03-08", "00:00");
        expect(a.diff(b, "day")).toBe(1);
    });

    it("Mar 6 → Mar 9 across spring-forward = 3 days", () => {
        const a = Badger.fromLocal("2026-03-09", "00:00");
        const b = Badger.fromLocal("2026-03-06", "00:00");
        expect(a.diff(b, "day")).toBe(3);
    });

    it("Oct 31 → Nov 2 across fall-back = 2 days", () => {
        const a = Badger.fromLocal("2026-11-02", "00:00");
        const b = Badger.fromLocal("2026-10-31", "00:00");
        expect(a.diff(b, "day")).toBe(2);
    });

    it("Nov 1 → Nov 2 (fall-back day itself) = 1 day", () => {
        const a = Badger.fromLocal("2026-11-02", "00:00");
        const b = Badger.fromLocal("2026-11-01", "00:00");
        expect(a.diff(b, "day")).toBe(1);
    });

    it("negative diff across spring-forward = -2 days", () => {
        const a = Badger.fromLocal("2026-03-07", "00:00");
        const b = Badger.fromLocal("2026-03-09", "00:00");
        expect(a.diff(b, "day")).toBe(-2);
    });
});

// ─── diff("day") integer — all 12 month-to-month transitions ─────────────────

describe("diff day integer — full year month boundaries in New York", () => {
    const transitions: [string, string, string, number][] = [
        ["Jan→Feb", "2026-01-01", "2026-02-01", 31],
        ["Feb→Mar", "2026-02-01", "2026-03-01", 28], // non-leap
        ["Mar→Apr", "2026-03-01", "2026-04-01", 31], // crosses spring-forward
        ["Apr→May", "2026-04-01", "2026-05-01", 30],
        ["May→Jun", "2026-05-01", "2026-06-01", 31],
        ["Jun→Jul", "2026-06-01", "2026-07-01", 30],
        ["Jul→Aug", "2026-07-01", "2026-08-01", 31],
        ["Aug→Sep", "2026-08-01", "2026-09-01", 31],
        ["Sep→Oct", "2026-09-01", "2026-10-01", 30],
        ["Oct→Nov", "2026-10-01", "2026-11-01", 31], // crosses fall-back
        ["Nov→Dec", "2026-11-01", "2026-12-01", 30],
        ["Dec→Jan", "2026-12-01", "2027-01-01", 31],
    ];

    for (const [label, startStr, endStr, expectedDays] of transitions) {
        it(`${label} = ${expectedDays} days`, () => {
            const a = Badger.fromLocal(endStr,   "00:00");
            const b = Badger.fromLocal(startStr, "00:00");
            expect(a.diff(b, "day")).toBe(expectedDays);
        });
    }
});

// ─── diff("day") float — DST days ────────────────────────────────────────────

describe("diff day float — New York", () => {
    it("spring-forward day is 23 real hours — float diff ≈ 0.958", () => {
        const a = Badger.fromLocal("2026-03-09", "00:00"); // midnight EDT
        const b = Badger.fromLocal("2026-03-08", "00:00"); // midnight EST
        expect(a.diff(b, "day", true)).toBeCloseTo(23 / 24, 5);
    });

    it("fall-back day is 25 real hours — float diff ≈ 1.0417", () => {
        const a = Badger.fromLocal("2026-11-02", "00:00"); // midnight EST
        const b = Badger.fromLocal("2026-11-01", "00:00"); // midnight EDT
        expect(a.diff(b, "day", true)).toBeCloseTo(25 / 24, 5);
    });

    it("normal mid-summer day is exactly 1.0", () => {
        const a = Badger.fromLocal("2026-07-16", "00:00");
        const b = Badger.fromLocal("2026-07-15", "00:00");
        expect(a.diff(b, "day", true)).toBe(1);
    });

    it("normal mid-winter day is exactly 1.0", () => {
        const a = Badger.fromLocal("2026-01-16", "00:00");
        const b = Badger.fromLocal("2026-01-15", "00:00");
        expect(a.diff(b, "day", true)).toBe(1);
    });
});

// ─── diff("week") integer — across DST ───────────────────────────────────────

describe("diff week integer — New York", () => {
    it("2 weeks spanning spring-forward = 2 weeks", () => {
        const a = Badger.fromLocal("2026-03-22", "00:00");
        const b = Badger.fromLocal("2026-03-08", "00:00");
        expect(a.diff(b, "week")).toBe(2);
    });

    it("2 weeks spanning fall-back = 2 weeks", () => {
        const a = Badger.fromLocal("2026-11-15", "00:00");
        const b = Badger.fromLocal("2026-11-01", "00:00");
        expect(a.diff(b, "week")).toBe(2);
    });
});

// ─── startOf / endOf on DST days ──────────────────────────────────────────────

describe("startOf / endOf — DST transition days in New York", () => {
    it("startOf('day') on spring-forward day gives local midnight", () => {
        const dt = Badger.fromLocal("2026-03-08", "12:00").startOf("day");
        expect(dt.hour).toBe(0);
        expect(dt.minute).toBe(0);
        expect(dt.day).toBe(8);
        expect(dt.month).toBe(3);
    });

    it("endOf('day') on spring-forward day gives 23:59:59.999 local", () => {
        const dt = Badger.fromLocal("2026-03-08", "12:00").endOf("day");
        expect(dt.hour).toBe(23);
        expect(dt.minute).toBe(59);
        expect(dt.second).toBe(59);
        expect(dt.day).toBe(8);
    });

    it("startOf('day') on fall-back day gives local midnight", () => {
        const dt = Badger.fromLocal("2026-11-01", "12:00").startOf("day");
        expect(dt.hour).toBe(0);
        expect(dt.day).toBe(1);
        expect(dt.month).toBe(11);
    });

    it("endOf('day') on fall-back day gives 23:59:59.999 local", () => {
        const dt = Badger.fromLocal("2026-11-01", "12:00").endOf("day");
        expect(dt.hour).toBe(23);
        expect(dt.minute).toBe(59);
        expect(dt.second).toBe(59);
        expect(dt.day).toBe(1);
    });
});

// ─── add / subtract across DST ───────────────────────────────────────────────

describe("add / subtract across DST — New York", () => {
    it("add(1, 'day') across spring-forward preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-03-07", "12:00").add(1, "day");
        expect(dt.day).toBe(8);
        expect(dt.month).toBe(3);
        expect(dt.hour).toBe(12);
    });

    it("add(1, 'day') on spring-forward day preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-03-08", "12:00").add(1, "day");
        expect(dt.day).toBe(9);
        expect(dt.month).toBe(3);
        expect(dt.hour).toBe(12);
    });

    it("add(1, 'day') across fall-back preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-10-31", "12:00").add(1, "day");
        expect(dt.day).toBe(1);
        expect(dt.month).toBe(11);
        expect(dt.hour).toBe(12);
    });

    it("subtract(1, 'day') across spring-forward preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-03-09", "12:00").subtract(1, "day");
        expect(dt.day).toBe(8);
        expect(dt.month).toBe(3);
        expect(dt.hour).toBe(12);
    });
});

// ─── isSame on DST days ───────────────────────────────────────────────────────

describe("isSame — DST transition days in New York", () => {
    it("two times on spring-forward day are isSame('day')", () => {
        const a = Badger.fromLocal("2026-03-08", "00:00");
        const b = Badger.fromLocal("2026-03-08", "23:59");
        expect(a.isSame(b, "day")).toBe(true);
    });

    it("midnight before and midnight after spring-forward are not isSame('day')", () => {
        const a = Badger.fromLocal("2026-03-07", "23:59");
        const b = Badger.fromLocal("2026-03-08", "00:00");
        expect(a.isSame(b, "day")).toBe(false);
    });

    it("two times on fall-back day are isSame('day')", () => {
        const a = Badger.fromLocal("2026-11-01", "00:00");
        const b = Badger.fromLocal("2026-11-01", "23:59");
        expect(a.isSame(b, "day")).toBe(true);
    });
});

// ─── addBusinessDays / subtractBusinessDays across DST ───────────────────────
// In New York, Mar 6 2026 is a Friday, Mar 7 Sat, Mar 8 Sun, Mar 9 Mon.
// Oct 30 2026 is a Friday, Oct 31 Sat, Nov 1 Sun, Nov 2 Mon.

describe("addBusinessDays / subtractBusinessDays — New York DST", () => {
    it("addBusinessDays(1) from Friday Mar 6 skips Sat+Sun, lands on Mon Mar 9", () => {
        const result = Badger.fromLocal("2026-03-06", "09:00").addBusinessDays(1);
        expect(result.day).toBe(9);
        expect(result.month).toBe(3);
        expect(result.dayOfWeek).toBe(1); // Monday
    });

    it("addBusinessDays(1) from Friday Oct 30 skips Sat+Sun, lands on Mon Nov 2", () => {
        const result = Badger.fromLocal("2026-10-30", "09:00").addBusinessDays(1);
        expect(result.day).toBe(2);
        expect(result.month).toBe(11);
        expect(result.dayOfWeek).toBe(1); // Monday
    });

    it("subtractBusinessDays(1) from Monday Mar 9 lands on Friday Mar 6", () => {
        const result = Badger.fromLocal("2026-03-09", "09:00").subtractBusinessDays(1);
        expect(result.day).toBe(6);
        expect(result.month).toBe(3);
        expect(result.dayOfWeek).toBe(5); // Friday
    });

    it("subtractBusinessDays(1) from Monday Nov 2 lands on Friday Oct 30", () => {
        const result = Badger.fromLocal("2026-11-02", "09:00").subtractBusinessDays(1);
        expect(result.day).toBe(30);
        expect(result.month).toBe(10);
        expect(result.dayOfWeek).toBe(5); // Friday
    });
});

// ─── isToday / isYesterday / isTomorrow around DST ───────────────────────────

describe("isToday / isYesterday / isTomorrow — New York DST", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(Badger.fromLocal("2026-03-08", "12:00").toDate());
    });
    afterEach(() => vi.useRealTimers());

    it("local noon on spring-forward day isToday", () => {
        expect(Badger.fromLocal("2026-03-08", "12:00").isToday()).toBe(true);
    });

    it("local midnight on spring-forward day isToday", () => {
        expect(Badger.fromLocal("2026-03-08", "00:00").isToday()).toBe(true);
    });

    it("day before spring-forward is isYesterday", () => {
        expect(Badger.fromLocal("2026-03-07", "12:00").isYesterday()).toBe(true);
    });

    it("day after spring-forward is isTomorrow", () => {
        expect(Badger.fromLocal("2026-03-09", "12:00").isTomorrow()).toBe(true);
    });
});

// ─── Badger.range across DST ─────────────────────────────────────────────────

describe("Badger.range — New York DST", () => {
    it("daily range Mar 7–10 across spring-forward returns 4 elements with correct local dates", () => {
        const result = Badger.range(
            Badger.fromLocal("2026-03-07", "00:00"),
            Badger.fromLocal("2026-03-11", "00:00"),
            "day"
        );
        expect(result).toHaveLength(4);
        expect(result.map(d => d.day)).toEqual([7, 8, 9, 10]);
        expect(result.map(d => d.month)).toEqual([3, 3, 3, 3]);
    });

    it("daily range Oct 30 – Nov 2 across fall-back returns 4 elements with correct local dates", () => {
        const result = Badger.range(
            Badger.fromLocal("2026-10-30", "00:00"),
            Badger.fromLocal("2026-11-03", "00:00"),
            "day"
        );
        expect(result).toHaveLength(4);
        expect(result.map(d => `${d.month}/${d.day}`)).toEqual(["10/30", "10/31", "11/1", "11/2"]);
    });
});
