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
import { BadgerSett } from "../src/BadgerSett";

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

// ─── isWeekend / isWeekday / addBusinessDays — local vs UTC ──────────────────
//
// In CEST (UTC+2), local midnight Saturday Jun 20 = Jun 19 22:00 UTC (Friday UTC).
// With getUTCDay() the old code saw "Friday" and said isWeekend=false — wrong.
// With getDay() the new code sees "Saturday" locally and says isWeekend=true — correct.
//
// addBusinessDays from local Friday midnight (= Thursday UTC):
//   Old code: first step lands on local Saturday midnight (= Friday UTC) → not a
//   weekend in UTC → immediately returns a Saturday local date as a "business day". WRONG.
//   New code: sees Saturday locally → skips it → skips Sunday → returns Monday. CORRECT.

describe("isWeekend / isWeekday / isBusinessDay — local vs UTC in CEST", () => {

    it("local Saturday midnight is a weekend (not Friday UTC)", () => {
        // Jun 20 00:00 CEST = Jun 19 22:00 UTC — getUTCDay() says Friday, getDay() says Saturday
        const saturday = Badger.fromLocal("2026-06-20", "00:00");
        expect(saturday.isWeekend()).toBe(true);
        expect(saturday.isWeekday()).toBe(false);
        expect(saturday.isBusinessDay()).toBe(false);
    });

    it("local Sunday midnight is a weekend (not Saturday UTC)", () => {
        // Jun 21 00:00 CEST = Jun 20 22:00 UTC — getUTCDay() says Saturday, getDay() says Sunday
        const sunday = Badger.fromLocal("2026-06-21", "00:00");
        expect(sunday.isWeekend()).toBe(true);
        expect(sunday.isWeekday()).toBe(false);
        expect(sunday.isBusinessDay()).toBe(false);
    });

    it("local Monday midnight is a business day (not Sunday UTC)", () => {
        // Jun 22 00:00 CEST = Jun 21 22:00 UTC — getUTCDay() says Sunday, getDay() says Monday
        const monday = Badger.fromLocal("2026-06-22", "00:00");
        expect(monday.isWeekend()).toBe(false);
        expect(monday.isWeekday()).toBe(true);
        expect(monday.isBusinessDay()).toBe(true);
    });

    it("addBusinessDays(1) from local Friday midnight skips Saturday+Sunday, lands on Monday", () => {
        // Jun 19 00:00 CEST = Jun 18 22:00 UTC (Thursday UTC).
        // Old getUTCDay() code: first step = Jun 19 22:00 UTC = Jun 20 CEST = Saturday locally, but
        // getUTCDay() says Friday → counted as business day → returned Saturday local. WRONG.
        // New getDay() code: correctly sees Saturday → skips → skips Sunday → returns Monday.
        const friday = Badger.fromLocal("2026-06-19", "00:00");
        const result = friday.addBusinessDays(1);
        expect(result.day).toBe(22);    // Monday June 22 — not Saturday June 20
        expect(result.month).toBe(6);
        expect(result.dayOfWeek).toBe(1); // 1 = Monday
    });

    it("subtractBusinessDays(1) from local Monday midnight skips Sunday+Saturday, lands on Friday", () => {
        const monday = Badger.fromLocal("2026-06-22", "00:00");
        const result = monday.subtractBusinessDays(1);
        expect(result.day).toBe(19);    // Friday June 19
        expect(result.month).toBe(6);
        expect(result.dayOfWeek).toBe(5); // 5 = Friday
    });

    // Regression: the walker steps one LOCAL calendar day at a time, so a
    // DST-shortened (spring-forward) or -lengthened (fall-back) local day is
    // never skipped or double-counted. Using ar-SA (weekend = Fri+Sat), SUNDAY
    // is a business day — so the DST-transition Sunday actually gets counted,
    // unlike a standard Sat/Sun weekend where a skipped Sunday would be masked.
    // Old UTC-stepping walker landed a 24h step past the 23h spring-forward
    // Sunday and skipped it entirely.
    describe("business-day walker across a DST transition (non-Sunday weekend)", () => {
        const arSA = new Intl.Locale("ar-SA"); // weekend Fri+Sat → Sunday is a business day
        const ymd = (d: Badger) =>
            `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

        it("addBusinessDays(1) from Sat 23:30 counts the spring-forward Sunday, not Monday", () => {
            // Europe/Berlin spring-forward: Sun 2026-03-29 02:00→03:00 (23h day).
            const sat = Badger.fromLocal("2026-03-28", "23:30");
            expect(ymd(sat.addBusinessDays(1, arSA))).toBe("2026-03-29");
        });

        it("subtractBusinessDays(1) from Mon 00:30 counts the spring-forward Sunday, not Saturday", () => {
            const mon = Badger.fromLocal("2026-03-30", "00:30");
            expect(ymd(mon.subtractBusinessDays(1, arSA))).toBe("2026-03-29");
        });

        it("addBusinessDays(1) from Sat 23:30 counts the fall-back Sunday, not Monday", () => {
            // Europe/Berlin fall-back: Sun 2026-10-25 03:00→02:00 (25h day).
            const sat = Badger.fromLocal("2026-10-24", "23:30");
            expect(ymd(sat.addBusinessDays(1, arSA))).toBe("2026-10-25");
        });
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

// ─── BadgerSett.startOfWeek — local vs UTC in CEST ───────────────────────────
//
// In CEST (UTC+2), local Saturday midnight Jun 20 = Jun 19 22:00 UTC (Friday UTC).
// The old code used getUTCDay() → saw Friday → returned Monday Jun 15 (wrong week).
// The new code uses getDay() → sees Saturday locally → returns Monday Jun 22 (correct).
//
// Similarly, local Monday midnight Jun 22 = Jun 21 22:00 UTC (Sunday UTC).
// Old code: getUTCDay() = Sunday → went back 6 days → returned Monday Jun 16 (wrong).
// New code: getDay() = Monday → daysBack = 0 → returns Jun 22 itself (correct).

describe("BadgerSett.startOfWeek — local time in CEST (en-GB, Mon start)", () => {

    it("local Saturday midnight returns the correct Monday (not the Monday of the UTC week)", () => {
        // Jun 20 00:00 CEST = Jun 19 22:00 UTC
        // Old: getUTCDay() = 5 (Fri) → daysBack = 4 → Jun 15 (wrong — that's the Mon of the prev week in UTC)
        // New: getDay() = 6 (Sat) → daysBack = 5 → Jun 15... wait let me recalc
        // Actually: jsFirstDay for en-GB = 1 (Mon). jsDay = 6 (Sat). daysBack = (6-1+7)%7 = 5.
        // result = Jun 20 - 5 days = Jun 15. Hmm, Jun 15 IS the Monday of that week locally.
        // Old: jsDay (UTC) = 5 (Fri). daysBack = (5-1+7)%7 = 4. Jun 20 - 4 = Jun 16 (Tuesday UTC).
        // So old returns Jun 16 local, new returns Jun 15 local. Jun 15 is correct (Mon of Jun 15-21 week).
        const saturdayMidnight = new BadgerSett(
            Badger.fromLocal("2026-06-20", "00:00").toDate(),
            new Intl.Locale("en-GB")
        );
        const result = saturdayMidnight.startOfWeek();
        // Should be Monday Jun 15 at local midnight (CEST = UTC+2, so 22:00 UTC Jun 14)
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(5);   // 0-indexed June
        expect(result.getDate()).toBe(15);   // Monday June 15 locally
        expect(result.getHours()).toBe(0);   // local midnight
        expect(result.getMinutes()).toBe(0);
    });

    it("local Monday midnight returns that same Monday (daysBack = 0)", () => {
        // Jun 22 00:00 CEST = Jun 21 22:00 UTC (Sunday UTC)
        // Old: getUTCDay() = 0 (Sun) → daysBack = (0-1+7)%7 = 6 → Jun 16 (wrong)
        // New: getDay() = 1 (Mon) → daysBack = 0 → Jun 22 itself (correct)
        const mondayMidnight = new BadgerSett(
            Badger.fromLocal("2026-06-22", "00:00").toDate(),
            new Intl.Locale("en-GB")
        );
        const result = mondayMidnight.startOfWeek();
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(5);
        expect(result.getDate()).toBe(22);   // Monday June 22 locally
        expect(result.getHours()).toBe(0);
    });

    it("mid-week date returns the correct Monday", () => {
        // Jun 17 12:00 CEST (Wednesday noon) → week starts Mon Jun 15
        const wednesday = new BadgerSett(
            Badger.fromLocal("2026-06-17", "12:00").toDate(),
            new Intl.Locale("en-GB")
        );
        const result = wednesday.startOfWeek();
        expect(result.getDate()).toBe(15);
        expect(result.getMonth()).toBe(5);
        expect(result.getHours()).toBe(0);
    });
});

// ─── Holiday key uses the LOCAL calendar date — CET/CEST ───────────────────────
// Local midnight in CET is the PREVIOUS day in UTC. The holiday key must be the
// local date (matching the local weekend evaluation), not the UTC slice.

describe("business-day holidays — local date keying (CET)", () => {
    it("a local-midnight holiday matches its LOCAL date, not the UTC-shifted one", () => {
        // Fri Dec 25 2026 00:00 CET == Thu Dec 24 2026 23:00 UTC.
        // toISOString().slice(0,10) would give '2026-12-24' (wrong); the local
        // date is '2026-12-25' — that is the key that must match.
        const xmas = Badger.fromLocal("2026-12-25", "00:00");
        expect(xmas.isBusinessDay(new Intl.Locale("en-GB"), ["2026-12-25"])).toBe(false);
        // and the UTC-shifted date must NOT be treated as the holiday
        expect(xmas.isBusinessDay(new Intl.Locale("en-GB"), ["2026-12-24"])).toBe(true);
    });
});
