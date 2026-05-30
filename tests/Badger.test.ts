import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Badger } from "../src/Badger";

// All tests run under TZ=UTC (set in vitest.config.ts).
// Local-time getters therefore equal UTC values, making assertions deterministic.

// ─── Constructor ──────────────────────────────────────────────────────────────

describe("Badger constructor", () => {
    it("no arg → valid date close to now", () => {
        const before = Date.now();
        const dt = new Badger();
        const after = Date.now();
        expect(dt.isValid()).toBe(true);
        expect(dt.toDate().getTime()).toBeGreaterThanOrEqual(before);
        expect(dt.toDate().getTime()).toBeLessThanOrEqual(after);
    });

    it("Date object → copies without sharing reference", () => {
        const d = new Date("2026-06-15T12:00:00Z");
        const dt = new Badger(d);
        d.setFullYear(2000);
        expect(dt.year).toBe(2026);
    });

    it("date-only string → UTC midnight", () => {
        const dt = new Badger("2026-03-15");
        expect(dt.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    });

    it("datetime string without timezone → appends Z (UTC)", () => {
        const dt = new Badger("2026-03-15T10:30:00");
        expect(dt.toISOString()).toBe("2026-03-15T10:30:00.000Z");
    });

    it("datetime string with Z → used as-is", () => {
        const dt = new Badger("2026-03-15T10:30:00Z");
        expect(dt.toISOString()).toBe("2026-03-15T10:30:00.000Z");
    });

    it("datetime string with +HH:MM offset → used as-is", () => {
        const dt = new Badger("2026-03-15T12:30:00+02:00");
        expect(dt.toISOString()).toBe("2026-03-15T10:30:00.000Z");
    });

    it("datetime string with -HH:MM offset → used as-is", () => {
        const dt = new Badger("2026-03-15T08:30:00-05:00");
        expect(dt.toISOString()).toBe("2026-03-15T13:30:00.000Z");
    });

    it("invalid string → isValid returns false", () => {
        const dt = new Badger("not-a-date");
        expect(dt.isValid()).toBe(false);
    });
});

// ─── fromLocal ────────────────────────────────────────────────────────────────

describe("Badger.fromLocal", () => {
    it("parses local date and time without UTC offset shift", () => {
        const dt = Badger.fromLocal("2026-05-22", "00:15");
        expect(dt.hour).toBe(0);
        expect(dt.minute).toBe(15);
    });

    it("correct day of week for a known Friday", () => {
        const dt = Badger.fromLocal("2026-05-22", "09:00");
        expect(dt.dayOfWeek).toBe(5); // Friday
    });

    it("midnight edge — day value is preserved", () => {
        const dt = Badger.fromLocal("2026-01-01", "00:00");
        expect(dt.day).toBe(1);
        expect(dt.month).toBe(1);
        expect(dt.year).toBe(2026);
    });

    it("end of day — 23:59", () => {
        const dt = Badger.fromLocal("2026-12-31", "23:59");
        expect(dt.hour).toBe(23);
        expect(dt.minute).toBe(59);
        expect(dt.day).toBe(31);
        expect(dt.month).toBe(12);
    });
});

// ─── Getters ──────────────────────────────────────────────────────────────────

describe("Badger getters", () => {
    const dt = new Badger("2026-07-04T15:30:45.123Z");

    it(".year", () => expect(dt.year).toBe(2026));
    it(".month (1-indexed)", () => expect(dt.month).toBe(7));
    it(".day", () => expect(dt.day).toBe(4));
    it(".hour", () => expect(dt.hour).toBe(15));
    it(".minute", () => expect(dt.minute).toBe(30));
    it(".second", () => expect(dt.second).toBe(45));
    it(".dayOfWeek — Saturday", () => expect(dt.dayOfWeek).toBe(6));

    it(".dayOfWeek — Sunday", () => {
        expect(new Badger("2026-07-05T00:00:00Z").dayOfWeek).toBe(0);
    });

    it(".dayOfWeek — Monday", () => {
        expect(new Badger("2026-07-06T00:00:00Z").dayOfWeek).toBe(1);
    });
});

// ─── getDaysInMonth ───────────────────────────────────────────────────────────

describe("getDaysInMonth", () => {
    it("January → 31", () => expect(new Badger("2026-01-01").getDaysInMonth()).toBe(31));
    it("February non-leap → 28", () => expect(new Badger("2026-02-01").getDaysInMonth()).toBe(28));
    it("February leap → 29", () => expect(new Badger("2024-02-01").getDaysInMonth()).toBe(29));
    it("April → 30", () => expect(new Badger("2026-04-01").getDaysInMonth()).toBe(30));
    it("December → 31", () => expect(new Badger("2026-12-01").getDaysInMonth()).toBe(31));
});

// ─── isLeapYear ───────────────────────────────────────────────────────────────

describe("isLeapYear", () => {
    it("2024 → true (divisible by 4)", () => expect(new Badger("2024-01-01").isLeapYear()).toBe(true));
    it("2000 → true (divisible by 400)", () => expect(new Badger("2000-01-01").isLeapYear()).toBe(true));
    it("1900 → false (divisible by 100, not 400)", () => expect(new Badger("1900-01-01").isLeapYear()).toBe(false));
    it("2026 → false", () => expect(new Badger("2026-01-01").isLeapYear()).toBe(false));
    it("2100 → false", () => expect(new Badger("2100-01-01").isLeapYear()).toBe(false));
});

// ─── getWeekNumber ────────────────────────────────────────────────────────────

describe("getWeekNumber", () => {
    it("ISO week 1 — Jan 4 is always in week 1", () => {
        expect(new Badger("2026-01-04").getWeekNumber()).toBe(1);
    });

    it("Jan 1 2026 (Thursday) is in week 1", () => {
        expect(new Badger("2026-01-01").getWeekNumber()).toBe(1);
    });

    it("Dec 28 2026 (Monday) is in week 53 — 2026 has 53 ISO weeks", () => {
        expect(new Badger("2026-12-28").getWeekNumber()).toBe(53);
    });

    it("Dec 31 2020 (Thursday) — belongs to week 53 of 2020", () => {
        expect(new Badger("2020-12-31").getWeekNumber()).toBe(53);
    });

    it("Jan 1 2021 (Friday) — belongs to week 53 of 2020", () => {
        expect(new Badger("2021-01-01").getWeekNumber()).toBe(53);
    });

    it("Jan 4 2021 (Monday) — week 1 of 2021", () => {
        expect(new Badger("2021-01-04").getWeekNumber()).toBe(1);
    });
});

// ─── toUnixTimestamp ──────────────────────────────────────────────────────────

describe("toUnixTimestamp", () => {
    it("returns Unix seconds (floored)", () => {
        const dt = new Badger("2026-01-01T00:00:00.500Z");
        expect(dt.toUnixTimestamp()).toBe(1767225600); // floored, not rounded
    });
});

// ─── clone / immutability ─────────────────────────────────────────────────────

describe("clone and immutability", () => {
    it("clone returns independent instance", () => {
        const dt = new Badger("2026-06-15T00:00:00Z");
        const cloned = dt.clone();
        expect(cloned.toISOString()).toBe(dt.toISOString());
        expect(cloned).not.toBe(dt);
    });

    it("add does not mutate original", () => {
        const dt = new Badger("2026-06-15T00:00:00Z");
        dt.add(7, "day");
        expect(dt.day).toBe(15); // unchanged
    });

    it("subtract does not mutate original", () => {
        const dt = new Badger("2026-06-15T00:00:00Z");
        dt.subtract(1, "month");
        expect(dt.month).toBe(6); // unchanged
    });

    it("startOf does not mutate original", () => {
        const dt = new Badger("2026-06-15T15:30:00Z");
        dt.startOf("day");
        expect(dt.hour).toBe(15); // unchanged
    });

    it("endOf does not mutate original", () => {
        const dt = new Badger("2026-06-15T00:00:00Z");
        dt.endOf("month");
        expect(dt.day).toBe(15); // unchanged
    });
});

// ─── startOf ─────────────────────────────────────────────────────────────────

describe("startOf", () => {
    it("startOf('minute') zeros seconds and ms", () => {
        const dt = new Badger("2026-06-15T10:30:45.999Z").startOf("minute");
        expect(dt.second).toBe(0);
        expect(dt.toISOString()).toBe("2026-06-15T10:30:00.000Z");
    });

    it("startOf('hour') zeros minutes, seconds, ms", () => {
        const dt = new Badger("2026-06-15T10:30:45.999Z").startOf("hour");
        expect(dt.toISOString()).toBe("2026-06-15T10:00:00.000Z");
    });

    it("startOf('day') zeros to midnight", () => {
        const dt = new Badger("2026-06-15T15:30:00Z").startOf("day");
        expect(dt.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    });

    it("startOf('week') → Monday for a Wednesday", () => {
        const dt = new Badger("2026-06-17T12:00:00Z"); // Wednesday
        expect(dt.startOf("week").toISOString()).toBe("2026-06-15T00:00:00.000Z"); // Monday
    });

    it("startOf('week') → same Monday for a Monday", () => {
        const dt = new Badger("2026-06-15T12:00:00Z"); // Monday
        expect(dt.startOf("week").toISOString()).toBe("2026-06-15T00:00:00.000Z");
    });

    it("startOf('week') → previous Monday for a Sunday", () => {
        const dt = new Badger("2026-06-21T12:00:00Z"); // Sunday
        expect(dt.startOf("week").toISOString()).toBe("2026-06-15T00:00:00.000Z"); // previous Monday
    });

    it("startOf('month') → first of the month", () => {
        const dt = new Badger("2026-06-15T12:00:00Z").startOf("month");
        expect(dt.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    });

    it("startOf('year') → Jan 1", () => {
        const dt = new Badger("2026-09-25T12:00:00Z").startOf("year");
        expect(dt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
});

// ─── endOf ────────────────────────────────────────────────────────────────────

describe("endOf", () => {
    it("endOf('minute') → :59.999", () => {
        const dt = new Badger("2026-06-15T10:30:00Z").endOf("minute");
        expect(dt.toISOString()).toBe("2026-06-15T10:30:59.999Z");
    });

    it("endOf('hour') → :59:59.999", () => {
        const dt = new Badger("2026-06-15T10:00:00Z").endOf("hour");
        expect(dt.toISOString()).toBe("2026-06-15T10:59:59.999Z");
    });

    it("endOf('day') → 23:59:59.999", () => {
        const dt = new Badger("2026-06-15T00:00:00Z").endOf("day");
        expect(dt.toISOString()).toBe("2026-06-15T23:59:59.999Z");
    });

    it("endOf('week') → Sunday 23:59:59.999", () => {
        const dt = new Badger("2026-06-17T12:00:00Z"); // Wednesday
        expect(dt.endOf("week").toISOString()).toBe("2026-06-21T23:59:59.999Z"); // Sunday
    });

    it("endOf('week') → same Sunday for a Sunday", () => {
        const dt = new Badger("2026-06-21T00:00:00Z"); // Sunday
        expect(dt.endOf("week").toISOString()).toBe("2026-06-21T23:59:59.999Z");
    });

    it("endOf('week') → Sunday for a Monday", () => {
        const dt = new Badger("2026-06-15T00:00:00Z"); // Monday
        expect(dt.endOf("week").toISOString()).toBe("2026-06-21T23:59:59.999Z");
    });

    it("endOf('month') → last day of the month", () => {
        const dt = new Badger("2026-02-10T00:00:00Z").endOf("month"); // Feb non-leap
        expect(dt.toISOString()).toBe("2026-02-28T23:59:59.999Z");
    });

    it("endOf('month') → Feb 29 in leap year", () => {
        const dt = new Badger("2024-02-10T00:00:00Z").endOf("month");
        expect(dt.toISOString()).toBe("2024-02-29T23:59:59.999Z");
    });

    it("endOf('year') → Dec 31 23:59:59.999", () => {
        const dt = new Badger("2026-06-15T00:00:00Z").endOf("year");
        expect(dt.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    });
});

// ─── add ─────────────────────────────────────────────────────────────────────

describe("add", () => {
    it("add days", () => {
        expect(new Badger("2026-06-15T00:00:00Z").add(7, "day").toISOString())
            .toBe("2026-06-22T00:00:00.000Z");
    });

    it("add days across month boundary", () => {
        expect(new Badger("2026-06-28T00:00:00Z").add(5, "day").toISOString())
            .toBe("2026-07-03T00:00:00.000Z");
    });

    it("add weeks", () => {
        expect(new Badger("2026-06-01T00:00:00Z").add(2, "week").toISOString())
            .toBe("2026-06-15T00:00:00.000Z");
    });

    it("add months — normal", () => {
        expect(new Badger("2026-01-15T00:00:00Z").add(1, "month").toISOString())
            .toBe("2026-02-15T00:00:00.000Z");
    });

    it("add months — Jan 31 + 1 clamps to Feb 28", () => {
        const result = new Badger("2026-01-31T00:00:00Z").add(1, "month");
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("add months — Jan 31 + 1 clamps to Feb 29 in leap year", () => {
        const result = new Badger("2024-01-31T00:00:00Z").add(1, "month");
        expect(result.month).toBe(2);
        expect(result.day).toBe(29);
    });

    it("add months — Oct 31 + 1 clamps to Nov 30", () => {
        const result = new Badger("2026-10-31T00:00:00Z").add(1, "month");
        expect(result.month).toBe(11);
        expect(result.day).toBe(30);
    });

    it("add years — normal", () => {
        expect(new Badger("2026-06-15T00:00:00Z").add(1, "year").year).toBe(2027);
    });

    it("add years — Feb 29 in leap year + 1 year clamps to Feb 28", () => {
        const result = new Badger("2024-02-29T00:00:00Z").add(1, "year");
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("add hours", () => {
        expect(new Badger("2026-06-15T22:00:00Z").add(3, "hour").toISOString())
            .toBe("2026-06-16T01:00:00.000Z");
    });

    it("add minutes", () => {
        expect(new Badger("2026-06-15T10:50:00Z").add(15, "minute").toISOString())
            .toBe("2026-06-15T11:05:00.000Z");
    });

    it("add milliseconds", () => {
        expect(new Badger("2026-06-15T00:00:00.000Z").add(1500, "millisecond").toISOString())
            .toBe("2026-06-15T00:00:01.500Z");
    });

    it("add negative amount → goes back", () => {
        expect(new Badger("2026-06-15T00:00:00Z").add(-1, "day").toISOString())
            .toBe("2026-06-14T00:00:00.000Z");
    });
});

// ─── subtract ────────────────────────────────────────────────────────────────

describe("subtract", () => {
    it("subtract days", () => {
        expect(new Badger("2026-06-15T00:00:00Z").subtract(5, "day").toISOString())
            .toBe("2026-06-10T00:00:00.000Z");
    });

    it("subtract months across year boundary", () => {
        const result = new Badger("2026-01-15T00:00:00Z").subtract(1, "month");
        expect(result.month).toBe(12);
        expect(result.year).toBe(2025);
    });

    it("subtract years", () => {
        expect(new Badger("2026-06-15T00:00:00Z").subtract(3, "year").year).toBe(2023);
    });
});

// ─── isBefore / isAfter ───────────────────────────────────────────────────────

describe("isBefore / isAfter", () => {
    const earlier = new Badger("2026-01-01T00:00:00Z");
    const later   = new Badger("2026-12-31T00:00:00Z");
    const same    = new Badger("2026-01-01T00:00:00Z");

    it("isBefore — true when earlier", () => expect(earlier.isBefore(later)).toBe(true));
    it("isBefore — false when equal", () => expect(earlier.isBefore(same)).toBe(false));
    it("isBefore — false when after", () => expect(later.isBefore(earlier)).toBe(false));

    it("isAfter — true when later", () => expect(later.isAfter(earlier)).toBe(true));
    it("isAfter — false when equal", () => expect(later.isAfter(new Badger("2026-12-31T00:00:00Z"))).toBe(false));
    it("isAfter — false when before", () => expect(earlier.isAfter(later)).toBe(false));

    it("isBefore accepts native Date", () => {
        expect(earlier.isBefore(new Date("2026-06-01T00:00:00Z"))).toBe(true);
    });

    it("isAfter accepts native Date", () => {
        expect(later.isAfter(new Date("2026-06-01T00:00:00Z"))).toBe(true);
    });
});

// ─── isSame ───────────────────────────────────────────────────────────────────

describe("isSame", () => {
    const a = new Badger("2026-06-15T10:30:45.000Z");
    const b = new Badger("2026-06-15T22:00:00.000Z");
    const c = new Badger("2026-07-15T10:30:45.000Z");

    it("no unit — exact match", () => {
        expect(a.isSame(new Badger("2026-06-15T10:30:45.000Z"))).toBe(true);
    });

    it("no unit — different ms → false", () => {
        expect(a.isSame(new Badger("2026-06-15T10:30:45.001Z"))).toBe(false);
    });

    it("'day' — same day, different time → true", () => expect(a.isSame(b, "day")).toBe(true));
    it("'day' — different day → false", () => expect(a.isSame(c, "day")).toBe(false));

    it("'month' — same month → true", () => expect(a.isSame(b, "month")).toBe(true));
    it("'month' — different month → false", () => expect(a.isSame(c, "month")).toBe(false));

    it("'year' — same year → true", () => expect(a.isSame(c, "year")).toBe(true));
    it("'year' — different year → false", () => {
        expect(a.isSame(new Badger("2025-06-15T00:00:00Z"), "year")).toBe(false);
    });

    it("'hour' — same hour → true", () => {
        const x = new Badger("2026-06-15T10:00:00Z");
        const y = new Badger("2026-06-15T10:59:59Z");
        expect(x.isSame(y, "hour")).toBe(true);
    });

    it("'hour' — different hour → false", () => expect(a.isSame(b, "hour")).toBe(false));

    it("'minute' — same minute → true", () => {
        const x = new Badger("2026-06-15T10:30:00Z");
        const y = new Badger("2026-06-15T10:30:59Z");
        expect(x.isSame(y, "minute")).toBe(true);
    });

    it("'minute' — different minute → false", () => {
        const x = new Badger("2026-06-15T10:30:00Z");
        const y = new Badger("2026-06-15T10:31:00Z");
        expect(x.isSame(y, "minute")).toBe(false);
    });

    it("'week' — same ISO week → true", () => {
        const mon = new Badger("2026-06-15T00:00:00Z");
        const sun = new Badger("2026-06-21T00:00:00Z");
        expect(mon.isSame(sun, "week")).toBe(true);
    });

    it("'week' — different ISO weeks → false", () => {
        const mon = new Badger("2026-06-15T00:00:00Z");
        const nextMon = new Badger("2026-06-22T00:00:00Z");
        expect(mon.isSame(nextMon, "week")).toBe(false);
    });

    it("'week' — year boundary: Jan 1 2021 and Dec 31 2020 are same ISO week", () => {
        const a = new Badger("2021-01-01T00:00:00Z");
        const b = new Badger("2020-12-31T00:00:00Z");
        expect(a.isSame(b, "week")).toBe(true);
    });

    it("accepts native Date", () => {
        expect(a.isSame(new Date("2026-06-15T10:30:45.000Z"))).toBe(true);
    });
});

// ─── isBetween ────────────────────────────────────────────────────────────────

describe("isBetween", () => {
    const start = new Badger("2026-01-01T00:00:00Z");
    const end   = new Badger("2026-12-31T00:00:00Z");
    const mid   = new Badger("2026-06-15T00:00:00Z");

    it("date between start and end → true", () => expect(mid.isBetween(start, end)).toBe(true));
    it("date equal to start → false (exclusive)", () => expect(start.isBetween(start, end)).toBe(false));
    it("date equal to end → false (exclusive)", () => expect(end.isBetween(start, end)).toBe(false));
    it("date before start → false", () => {
        expect(new Badger("2025-12-31T00:00:00Z").isBetween(start, end)).toBe(false);
    });
    it("date after end → false", () => {
        expect(new Badger("2027-01-01T00:00:00Z").isBetween(start, end)).toBe(false);
    });
});

// ─── isToday / isYesterday / isTomorrow ──────────────────────────────────────

describe("isToday / isYesterday / isTomorrow", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("isToday — true for same day", () => {
        expect(new Badger("2026-06-15T00:00:00Z").isToday()).toBe(true);
    });

    it("isToday — false for different day", () => {
        expect(new Badger("2026-06-14T00:00:00Z").isToday()).toBe(false);
    });

    it("isYesterday — true for previous day", () => {
        expect(new Badger("2026-06-14T00:00:00Z").isYesterday()).toBe(true);
    });

    it("isYesterday — false for today", () => {
        expect(new Badger("2026-06-15T00:00:00Z").isYesterday()).toBe(false);
    });

    it("isTomorrow — true for next day", () => {
        expect(new Badger("2026-06-16T00:00:00Z").isTomorrow()).toBe(true);
    });

    it("isTomorrow — false for today", () => {
        expect(new Badger("2026-06-15T00:00:00Z").isTomorrow()).toBe(false);
    });
});

// ─── isWeekend / isWeekday ────────────────────────────────────────────────────

describe("isWeekend / isWeekday", () => {
    it("Saturday → isWeekend true", () => expect(new Badger("2026-06-20T00:00:00Z").isWeekend()).toBe(true));
    it("Sunday → isWeekend true", () => expect(new Badger("2026-06-21T00:00:00Z").isWeekend()).toBe(true));
    it("Monday → isWeekend false", () => expect(new Badger("2026-06-15T00:00:00Z").isWeekend()).toBe(false));
    it("Friday → isWeekend false", () => expect(new Badger("2026-06-19T00:00:00Z").isWeekend()).toBe(false));
    it("Saturday → isWeekday false", () => expect(new Badger("2026-06-20T00:00:00Z").isWeekday()).toBe(false));
    it("Monday → isWeekday true", () => expect(new Badger("2026-06-15T00:00:00Z").isWeekday()).toBe(true));
});

// ─── diff ────────────────────────────────────────────────────────────────────

describe("diff", () => {
    const a = new Badger("2026-06-15T10:00:00.000Z");
    const b = new Badger("2026-06-15T08:00:00.000Z");

    it("milliseconds — positive when this > other", () => {
        expect(a.diff(b, "millisecond")).toBe(7_200_000);
    });

    it("milliseconds — negative when this < other", () => {
        expect(b.diff(a, "millisecond")).toBe(-7_200_000);
    });

    it("minutes", () => expect(a.diff(b, "minute")).toBe(120));

    it("hours", () => expect(a.diff(b, "hour")).toBe(2));

    it("days", () => {
        const x = new Badger("2026-06-20T00:00:00Z");
        const y = new Badger("2026-06-15T00:00:00Z");
        expect(x.diff(y, "day")).toBe(5);
    });

    it("weeks", () => {
        const x = new Badger("2026-07-15T00:00:00Z");
        const y = new Badger("2026-06-15T00:00:00Z");
        expect(x.diff(y, "week")).toBe(4);
    });

    it("months — calendar based", () => {
        const x = new Badger("2026-09-01T00:00:00Z");
        const y = new Badger("2026-06-01T00:00:00Z");
        expect(x.diff(y, "month")).toBe(3);
    });

    it("months — across year boundary", () => {
        const x = new Badger("2027-02-01T00:00:00Z");
        const y = new Badger("2026-11-01T00:00:00Z");
        expect(x.diff(y, "month")).toBe(3);
    });

    it("years — calendar based", () => {
        const x = new Badger("2030-01-01T00:00:00Z");
        const y = new Badger("2026-01-01T00:00:00Z");
        expect(x.diff(y, "year")).toBe(4);
    });

    it("diff is zero when dates are equal", () => {
        const x = new Badger("2026-06-15T10:00:00Z");
        const y = new Badger("2026-06-15T10:00:00Z");
        expect(x.diff(y, "millisecond")).toBe(0);
    });

    it("floors partial days (23h 59m → 0 days)", () => {
        const x = new Badger("2026-06-15T23:59:00Z");
        const y = new Badger("2026-06-15T00:00:00Z");
        expect(x.diff(y, "day")).toBe(0);
    });

    it("accepts native Date", () => {
        expect(a.diff(new Date("2026-06-15T08:00:00Z"), "hour")).toBe(2);
    });
});

// ─── toDate ───────────────────────────────────────────────────────────────────

describe("toDate", () => {
    it("returns a copy — mutating it does not affect the Badger", () => {
        const dt = new Badger("2026-06-15T00:00:00Z");
        const d = dt.toDate();
        d.setFullYear(2000);
        expect(dt.year).toBe(2026);
    });
});
