/**
 * CET/CEST timezone tests for Badger.
 *
 * Run with: npm run test:cet  (sets TZ=Europe/Berlin)
 *
 * 2026 DST transitions in Europe/Berlin:
 *   Spring forward — March 29 at 02:00 CET → 03:00 CEST  (23-hour day)
 *   Fall back      — October 25 at 03:00 CEST → 02:00 CET (25-hour day)
 *
 * All dates are constructed via Badger.fromLocal() so that "local midnight"
 * means CET/CEST midnight, not UTC midnight.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Badger } from "../src/Badger";

// ─── dayOfYear ────────────────────────────────────────────────────────────────

describe("dayOfYear — CET/CEST", () => {

    it("March 30 local midnight (CEST, UTC+2) → day 89", () => {
        // Local midnight is March 29 22:00 UTC — the old ms-based code
        // subtracted a CET-offset start and gave 88 instead of 89.
        expect(Badger.fromLocal("2026-03-30", "00:00").dayOfYear).toBe(89);
    });

    it("March 29 local noon (CEST after spring-forward) → day 88", () => {
        expect(Badger.fromLocal("2026-03-29", "12:00").dayOfYear).toBe(88);
    });

    it("March 28 local noon (CET, day before spring-forward) → day 87", () => {
        expect(Badger.fromLocal("2026-03-28", "12:00").dayOfYear).toBe(87);
    });

    it("Oct 25 local midnight (CEST, UTC+2, fall-back day) → day 298", () => {
        // Local midnight is October 24 22:00 UTC — the old code gave 297.
        expect(Badger.fromLocal("2026-10-25", "00:00").dayOfYear).toBe(298);
    });

    it("Oct 25 local noon (CET, after fall-back) → day 298", () => {
        expect(Badger.fromLocal("2026-10-25", "12:00").dayOfYear).toBe(298);
    });

    it("Oct 26 local midnight (CET) → day 299", () => {
        expect(Badger.fromLocal("2026-10-26", "00:00").dayOfYear).toBe(299);
    });

    it("Jan 1 midnight → day 1", () => {
        expect(Badger.fromLocal("2026-01-01", "00:00").dayOfYear).toBe(1);
    });

    it("Dec 31 midnight (CET) → day 365", () => {
        expect(Badger.fromLocal("2026-12-31", "00:00").dayOfYear).toBe(365);
    });
});

// ─── diff("day") — integer ────────────────────────────────────────────────────

describe("diff day integer — CET/CEST", () => {

    it("March 28 → March 30 across spring-forward = 2 days", () => {
        // Only 47 real hours elapsed, but the calendar distance is 2 days.
        // The old ms-based code returned 1.
        const a = Badger.fromLocal("2026-03-30", "00:00");
        const b = Badger.fromLocal("2026-03-28", "00:00");
        expect(a.diff(b, "day")).toBe(2);
    });

    it("March 29 → March 30 (spring-forward day itself) = 1 day", () => {
        const a = Badger.fromLocal("2026-03-30", "00:00");
        const b = Badger.fromLocal("2026-03-29", "00:00");
        expect(a.diff(b, "day")).toBe(1);
    });

    it("March 27 → March 30 across spring-forward = 3 days", () => {
        const a = Badger.fromLocal("2026-03-30", "00:00");
        const b = Badger.fromLocal("2026-03-27", "00:00");
        expect(a.diff(b, "day")).toBe(3);
    });

    it("Oct 24 → Oct 26 across fall-back = 2 days", () => {
        const a = Badger.fromLocal("2026-10-26", "00:00");
        const b = Badger.fromLocal("2026-10-24", "00:00");
        expect(a.diff(b, "day")).toBe(2);
    });

    it("Oct 25 → Oct 26 (fall-back day itself) = 1 day", () => {
        const a = Badger.fromLocal("2026-10-26", "00:00");
        const b = Badger.fromLocal("2026-10-25", "00:00");
        expect(a.diff(b, "day")).toBe(1);
    });

    it("negative diff across spring-forward = -2 days", () => {
        const a = Badger.fromLocal("2026-03-28", "00:00");
        const b = Badger.fromLocal("2026-03-30", "00:00");
        expect(a.diff(b, "day")).toBe(-2);
    });
});

// ─── diff("day") — float ──────────────────────────────────────────────────────

describe("diff day float — CET/CEST", () => {

    it("spring-forward day is 23 real hours — float diff ≈ 0.958", () => {
        // March 30 midnight CEST (22:00 UTC) minus March 29 midnight CET (23:00 UTC prev day)
        // = 23 hours exactly
        const a = Badger.fromLocal("2026-03-30", "00:00");
        const b = Badger.fromLocal("2026-03-29", "00:00");
        expect(a.diff(b, "day", true)).toBeCloseTo(23 / 24, 5);
    });

    it("fall-back day is 25 real hours — float diff ≈ 1.0417", () => {
        // Oct 26 midnight CET (23:00 UTC) minus Oct 25 midnight CEST (22:00 UTC prev day)
        // = 25 hours exactly
        const a = Badger.fromLocal("2026-10-26", "00:00");
        const b = Badger.fromLocal("2026-10-25", "00:00");
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

// ─── diff("week") — integer ───────────────────────────────────────────────────

describe("diff week integer — CET/CEST", () => {

    it("2 weeks spanning spring-forward = 2 weeks", () => {
        const a = Badger.fromLocal("2026-04-12", "00:00");
        const b = Badger.fromLocal("2026-03-29", "00:00");
        expect(a.diff(b, "week")).toBe(2);
    });

    it("2 weeks spanning fall-back = 2 weeks", () => {
        const a = Badger.fromLocal("2026-11-08", "00:00");
        const b = Badger.fromLocal("2026-10-25", "00:00");
        expect(a.diff(b, "week")).toBe(2);
    });
});

// ─── startOf / endOf on DST days ──────────────────────────────────────────────

describe("startOf / endOf — DST transition days", () => {

    it("startOf('day') on spring-forward day gives local midnight", () => {
        const dt = Badger.fromLocal("2026-03-29", "12:00").startOf("day");
        expect(dt.hour).toBe(0);
        expect(dt.minute).toBe(0);
        expect(dt.day).toBe(29);
        expect(dt.month).toBe(3);
    });

    it("endOf('day') on spring-forward day gives 23:59:59.999 local", () => {
        const dt = Badger.fromLocal("2026-03-29", "12:00").endOf("day");
        expect(dt.hour).toBe(23);
        expect(dt.minute).toBe(59);
        expect(dt.second).toBe(59);
        expect(dt.millisecond).toBe(999);
        expect(dt.day).toBe(29);
    });

    it("startOf('day') on fall-back day gives local midnight", () => {
        const dt = Badger.fromLocal("2026-10-25", "12:00").startOf("day");
        expect(dt.hour).toBe(0);
        expect(dt.day).toBe(25);
        expect(dt.month).toBe(10);
    });

    it("endOf('day') on fall-back day gives 23:59:59.999 local", () => {
        const dt = Badger.fromLocal("2026-10-25", "12:00").endOf("day");
        expect(dt.hour).toBe(23);
        expect(dt.minute).toBe(59);
        expect(dt.second).toBe(59);
        expect(dt.day).toBe(25);
    });
});

// ─── add / subtract across DST ───────────────────────────────────────────────

describe("add / subtract across DST transitions", () => {

    it("add(1, 'day') across spring-forward preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-03-28", "12:00").add(1, "day");
        expect(dt.day).toBe(29);
        expect(dt.month).toBe(3);
        expect(dt.hour).toBe(12);
    });

    it("add(1, 'day') on spring-forward day preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-03-29", "12:00").add(1, "day");
        expect(dt.day).toBe(30);
        expect(dt.month).toBe(3);
        expect(dt.hour).toBe(12);
    });

    it("add(1, 'day') across fall-back preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-10-24", "12:00").add(1, "day");
        expect(dt.day).toBe(25);
        expect(dt.month).toBe(10);
        expect(dt.hour).toBe(12);
    });

    it("subtract(1, 'day') across spring-forward preserves wall-clock time", () => {
        const dt = Badger.fromLocal("2026-03-30", "12:00").subtract(1, "day");
        expect(dt.day).toBe(29);
        expect(dt.month).toBe(3);
        expect(dt.hour).toBe(12);
    });
});

// ─── isSame on DST days ───────────────────────────────────────────────────────

describe("isSame — DST transition days", () => {

    it("two times on spring-forward day are isSame('day')", () => {
        const a = Badger.fromLocal("2026-03-29", "00:00");
        const b = Badger.fromLocal("2026-03-29", "23:59");
        expect(a.isSame(b, "day")).toBe(true);
    });

    it("midnight before and midnight after spring-forward are not isSame('day')", () => {
        const a = Badger.fromLocal("2026-03-28", "23:59");
        const b = Badger.fromLocal("2026-03-29", "00:00");
        expect(a.isSame(b, "day")).toBe(false);
    });

    it("two times on fall-back day are isSame('day')", () => {
        const a = Badger.fromLocal("2026-10-25", "00:00");
        const b = Badger.fromLocal("2026-10-25", "23:59");
        expect(a.isSame(b, "day")).toBe(true);
    });
});

// ─── isToday / isYesterday / isTomorrow around DST ───────────────────────────

describe("isToday / isYesterday / isTomorrow — DST transitions", () => {

    beforeEach(() => {
        vi.useFakeTimers();
        // Fake "now" = March 29 12:00 CET/CEST (noon on spring-forward day)
        vi.setSystemTime(Badger.fromLocal("2026-03-29", "12:00").toDate());
    });
    afterEach(() => vi.useRealTimers());

    it("local noon on spring-forward day isToday", () => {
        expect(Badger.fromLocal("2026-03-29", "12:00").isToday()).toBe(true);
    });

    it("local midnight on spring-forward day isToday", () => {
        expect(Badger.fromLocal("2026-03-29", "00:00").isToday()).toBe(true);
    });

    it("day before spring-forward is isYesterday", () => {
        expect(Badger.fromLocal("2026-03-28", "12:00").isYesterday()).toBe(true);
    });

    it("day after spring-forward is isTomorrow", () => {
        expect(Badger.fromLocal("2026-03-30", "12:00").isTomorrow()).toBe(true);
    });
});

// ─── getWeekNumber around spring-forward ─────────────────────────────────────

describe("getWeekNumber — around spring-forward", () => {
    // March 29 2026 is Sunday (last day of ISO week 13)
    // March 30 2026 is Monday (first day of ISO week 14)

    it("March 29 (Sunday, spring-forward day) → week 13", () => {
        expect(Badger.fromLocal("2026-03-29", "12:00").getWeekNumber()).toBe(13);
    });

    it("March 30 (Monday, day after spring-forward) → week 14", () => {
        expect(Badger.fromLocal("2026-03-30", "09:00").getWeekNumber()).toBe(14);
    });

    it("March 23 (Monday, opens week 13) → week 13", () => {
        expect(Badger.fromLocal("2026-03-23", "12:00").getWeekNumber()).toBe(13);
    });
});
