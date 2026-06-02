import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Badger } from "../src/Badger";
import { BadgerSettings } from "../src/BadgerSettings";

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
    it(".millisecond", () => expect(dt.millisecond).toBe(123));
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

// ─── toMillisecondTimestamp ───────────────────────────────────────────────────

describe("toMillisecondTimestamp", () => {
    it("returns exact milliseconds", () => {
        const dt = new Badger("2026-01-01T00:00:00.500Z");
        expect(dt.toMillisecondTimestamp()).toBe(1767225600500);
    });

    it("before Unix epoch returns negative", () => {
        const dt = new Badger("1969-12-31T23:59:59.999Z");
        expect(dt.toMillisecondTimestamp()).toBe(-1);
    });

    it("toMillisecondTimestamp = toUnixTimestamp * 1000 when no sub-second component", () => {
        const dt = new Badger("2026-06-15T10:00:00.000Z");
        expect(dt.toMillisecondTimestamp()).toBe(dt.toUnixTimestamp() * 1000);
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

    // default "()" exclusive
    it("date between start and end → true", () => expect(mid.isBetween(start, end)).toBe(true));
    it("date equal to start → false (exclusive)", () => expect(start.isBetween(start, end)).toBe(false));
    it("date equal to end → false (exclusive)", () => expect(end.isBetween(start, end)).toBe(false));
    it("date before start → false", () => {
        expect(new Badger("2025-12-31T00:00:00Z").isBetween(start, end)).toBe(false);
    });
    it("date after end → false", () => {
        expect(new Badger("2027-01-01T00:00:00Z").isBetween(start, end)).toBe(false);
    });

    // both inclusive
    it("{ includeStart: true, includeEnd: true } — equal to start → true", () =>
        expect(start.isBetween(start, end, { includeStart: true, includeEnd: true })).toBe(true));
    it("{ includeStart: true, includeEnd: true } — equal to end → true", () =>
        expect(end.isBetween(start, end, { includeStart: true, includeEnd: true })).toBe(true));
    it("{ includeStart: true, includeEnd: true } — mid → true", () =>
        expect(mid.isBetween(start, end, { includeStart: true, includeEnd: true })).toBe(true));
    it("{ includeStart: true, includeEnd: true } — before start → false", () =>
        expect(new Badger("2025-12-31T00:00:00Z").isBetween(start, end, { includeStart: true, includeEnd: true })).toBe(false));

    // inclusive start only
    it("{ includeStart: true } — equal to start → true", () =>
        expect(start.isBetween(start, end, { includeStart: true })).toBe(true));
    it("{ includeStart: true } — equal to end → false", () =>
        expect(end.isBetween(start, end, { includeStart: true })).toBe(false));

    // inclusive end only
    it("{ includeEnd: true } — equal to start → false", () =>
        expect(start.isBetween(start, end, { includeEnd: true })).toBe(false));
    it("{ includeEnd: true } — equal to end → true", () =>
        expect(end.isBetween(start, end, { includeEnd: true })).toBe(true));

    it("accepts native Date for start and end", () => {
        expect(mid.isBetween(new Date("2026-01-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"))).toBe(true);
    });

    it("inverted range (start > end) throws RangeError", () => {
        expect(() => mid.isBetween(end, start)).toThrow(RangeError);
    });

    it("zero-width range (start === end) with both inclusive — equal date → true", () => {
        expect(start.isBetween(start, start, { includeStart: true, includeEnd: true })).toBe(true);
    });

    it("zero-width range (start === end) exclusive — equal date → false", () => {
        expect(start.isBetween(start, start)).toBe(false);
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

    it("months diff accepts native Date", () => {
        const x = new Badger("2026-09-01T00:00:00Z");
        expect(x.diff(new Date("2026-06-01T00:00:00Z"), "month")).toBe(3);
    });

    it("quarter diff accepts native Date", () => {
        const x = new Badger("2026-04-01T00:00:00Z");
        expect(x.diff(new Date("2026-01-01T00:00:00Z"), "quarter")).toBe(1);
    });

    it("year diff accepts native Date", () => {
        const x = new Badger("2030-01-01T00:00:00Z");
        expect(x.diff(new Date("2026-01-01T00:00:00Z"), "year")).toBe(4);
    });

    it("month diff is calendar-based — Jan 31 to Feb 1 = 1 month (different calendar months)", () => {
        const a = new Badger("2026-02-01T00:00:00Z");
        const b = new Badger("2026-01-31T00:00:00Z");
        expect(a.diff(b, "month")).toBe(1);
    });

    it("month diff is calendar-based — Jan 1 to Jan 31 = 0 months (same calendar month)", () => {
        const a = new Badger("2026-01-31T00:00:00Z");
        const b = new Badger("2026-01-01T00:00:00Z");
        expect(a.diff(b, "month")).toBe(0);
    });
});

// ─── isSame with second / millisecond / quarter ───────────────────────────────

describe("isSame — second, millisecond, quarter units", () => {
    it("'second' — same second → true", () => {
        const a = new Badger("2026-06-15T10:30:45.000Z");
        const b = new Badger("2026-06-15T10:30:45.999Z");
        expect(a.isSame(b, "second")).toBe(true);
    });

    it("'second' — different second → false", () => {
        const a = new Badger("2026-06-15T10:30:45.000Z");
        const b = new Badger("2026-06-15T10:30:46.000Z");
        expect(a.isSame(b, "second")).toBe(false);
    });

    it("'millisecond' — exact match → true", () => {
        const a = new Badger("2026-06-15T10:30:45.123Z");
        const b = new Badger("2026-06-15T10:30:45.123Z");
        expect(a.isSame(b, "millisecond")).toBe(true);
    });

    it("'millisecond' — differ by 1ms → false", () => {
        const a = new Badger("2026-06-15T10:30:45.123Z");
        const b = new Badger("2026-06-15T10:30:45.124Z");
        expect(a.isSame(b, "millisecond")).toBe(false);
    });

    it("'quarter' — same quarter → true", () => {
        const a = new Badger("2026-01-01T00:00:00Z");
        const b = new Badger("2026-03-31T00:00:00Z");
        expect(a.isSame(b, "quarter")).toBe(true);
    });

    it("'quarter' — different quarter → false", () => {
        const a = new Badger("2026-01-01T00:00:00Z");
        const b = new Badger("2026-04-01T00:00:00Z");
        expect(a.isSame(b, "quarter")).toBe(false);
    });

    it("'quarter' — same quarter different years → false", () => {
        const a = new Badger("2026-01-01T00:00:00Z");
        const b = new Badger("2027-01-01T00:00:00Z");
        expect(a.isSame(b, "quarter")).toBe(false);
    });
});

// ─── add quarter unit ─────────────────────────────────────────────────────────

describe("add / subtract quarter unit", () => {
    it("add 1 quarter — Q1 → Q2", () => {
        const result = new Badger("2026-01-15T00:00:00Z").add(1, "quarter");
        expect(result.month).toBe(4);
        expect(result.day).toBe(15);
    });

    it("add 4 quarters → same date next year", () => {
        const result = new Badger("2026-06-15T00:00:00Z").add(4, "quarter");
        expect(result.year).toBe(2027);
        expect(result.month).toBe(6);
    });

    it("add quarter clamps end-of-month (Jan 31 + 1 quarter → Apr 30)", () => {
        const result = new Badger("2026-01-31T00:00:00Z").add(1, "quarter");
        expect(result.month).toBe(4);
        expect(result.day).toBe(30);
    });

    it("subtract 1 quarter", () => {
        const result = new Badger("2026-04-15T00:00:00Z").subtract(1, "quarter");
        expect(result.month).toBe(1);
        expect(result.day).toBe(15);
    });
});

// ─── diff quarter unit ────────────────────────────────────────────────────────

describe("diff — quarter unit", () => {
    it("1 quarter apart", () => {
        const a = new Badger("2026-04-01T00:00:00Z");
        const b = new Badger("2026-01-01T00:00:00Z");
        expect(a.diff(b, "quarter")).toBe(1);
    });

    it("4 quarters apart → 1 year", () => {
        const a = new Badger("2027-01-01T00:00:00Z");
        const b = new Badger("2026-01-01T00:00:00Z");
        expect(a.diff(b, "quarter")).toBe(4);
    });

    it("negative when this is before other", () => {
        const a = new Badger("2026-01-01T00:00:00Z");
        const b = new Badger("2026-04-01T00:00:00Z");
        expect(a.diff(b, "quarter")).toBe(-1);
    });

    it("same quarter → 0", () => {
        const a = new Badger("2026-02-15T00:00:00Z");
        const b = new Badger("2026-01-01T00:00:00Z");
        expect(a.diff(b, "quarter")).toBe(0);
    });
});

// ─── diff with float option ───────────────────────────────────────────────────

describe("diff float option", () => {
    it("hours — 1.5 hours returns 1 without float", () => {
        const a = new Badger("2026-06-15T10:30:00.000Z");
        const b = new Badger("2026-06-15T09:00:00.000Z");
        expect(a.diff(b, "hour")).toBe(1);
    });

    it("hours — 1.5 hours returns 1.5 with float", () => {
        const a = new Badger("2026-06-15T10:30:00.000Z");
        const b = new Badger("2026-06-15T09:00:00.000Z");
        expect(a.diff(b, "hour", true)).toBe(1.5);
    });

    it("days — 1.5 days returns 1 without float", () => {
        const a = new Badger("2026-06-16T12:00:00.000Z");
        const b = new Badger("2026-06-15T00:00:00.000Z");
        expect(a.diff(b, "day")).toBe(1);
    });

    it("days — 1.5 days returns 1.5 with float", () => {
        const a = new Badger("2026-06-16T12:00:00.000Z");
        const b = new Badger("2026-06-15T00:00:00.000Z");
        expect(a.diff(b, "day", true)).toBe(1.5);
    });

    it("minutes — 1.5 minutes returns 1 without float", () => {
        const a = new Badger("2026-06-15T10:01:30.000Z");
        const b = new Badger("2026-06-15T10:00:00.000Z");
        expect(a.diff(b, "minute")).toBe(1);
    });

    it("minutes — 1.5 minutes returns 1.5 with float", () => {
        const a = new Badger("2026-06-15T10:01:30.000Z");
        const b = new Badger("2026-06-15T10:00:00.000Z");
        expect(a.diff(b, "minute", true)).toBe(1.5);
    });

    it("float false (explicit) behaves same as no flag", () => {
        const a = new Badger("2026-06-15T10:30:00.000Z");
        const b = new Badger("2026-06-15T09:00:00.000Z");
        expect(a.diff(b, "hour", false)).toBe(1);
    });

    it("milliseconds and seconds ignore float (always exact)", () => {
        const a = new Badger("2026-06-15T10:00:01.500Z");
        const b = new Badger("2026-06-15T10:00:00.000Z");
        expect(a.diff(b, "millisecond", true)).toBe(1500);
        expect(a.diff(b, "second", true)).toBe(1.5);
    });

    it("weeks — fractional weeks with float", () => {
        const a = new Badger("2026-06-26T12:00:00.000Z"); // 11.5 days after Jun 15
        const b = new Badger("2026-06-15T00:00:00.000Z");
        expect(a.diff(b, "week", true)).toBeCloseTo(11.5 / 7, 5);
    });

    it("weeks — integer path via native Date", () => {
        const a = new Badger("2026-07-15T00:00:00.000Z");
        expect(a.diff(new Date("2026-06-15T00:00:00.000Z"), "week")).toBe(4);
    });

    it("days — integer path via native Date", () => {
        const a = new Badger("2026-06-20T00:00:00.000Z");
        expect(a.diff(new Date("2026-06-15T00:00:00.000Z"), "day")).toBe(5);
    });
});

// ─── add / subtract with object ───────────────────────────────────────────────

describe("add / subtract with object", () => {
    const dt = new Badger("2026-06-15T10:00:00.000Z");

    it("add single unit via object", () => {
        expect(dt.add({ days: 7 }).toISOString()).toBe("2026-06-22T10:00:00.000Z");
    });

    it("add multiple units at once", () => {
        expect(dt.add({ days: 1, hours: 2, minutes: 30 }).toISOString()).toBe("2026-06-16T12:30:00.000Z");
    });

    it("add months and days together", () => {
        const result = dt.add({ months: 1, days: 5 });
        expect(result.month).toBe(7);
        expect(result.day).toBe(20);
    });

    it("subtract single unit via object", () => {
        expect(dt.subtract({ hours: 2 }).toISOString()).toBe("2026-06-15T08:00:00.000Z");
    });

    it("subtract multiple units", () => {
        expect(dt.subtract({ days: 1, hours: 1 }).toISOString()).toBe("2026-06-14T09:00:00.000Z");
    });

    it("does not mutate original", () => {
        dt.add({ years: 10 });
        expect(dt.year).toBe(2026);
    });

    it("empty object returns clone", () => {
        expect(dt.add({}).toISOString()).toBe(dt.toISOString());
    });

    it("singular and plural keys both work — years/year, days/day", () => {
        expect(dt.add({ year: 1 }).year).toBe(2027);
        expect(dt.add({ years: 1 }).year).toBe(2027);
        expect(dt.add({ day: 1 }).day).toBe(16);
        expect(dt.add({ days: 1 }).day).toBe(16);
    });
});

// ─── toObject ─────────────────────────────────────────────────────────────────

describe("toObject", () => {
    it("returns all fields correctly", () => {
        const dt = new Badger("2026-07-04T15:30:45.123Z");
        expect(dt.toObject()).toEqual({
            year: 2026,
            month: 7,
            day: 4,
            hour: 15,
            minute: 30,
            second: 45,
            millisecond: 123
        });
    });

    it("Jan 1 midnight", () => {
        const dt = new Badger("2026-01-01T00:00:00.000Z");
        expect(dt.toObject()).toEqual({
            year: 2026,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0
        });
    });

    it("returned object is a plain object, not a Badger", () => {
        const obj = new Badger("2026-06-15T00:00:00Z").toObject();
        expect(obj).not.toBeInstanceOf(Badger);
    });

    it("mutating returned object does not affect the Badger", () => {
        const dt = new Badger("2026-06-15T00:00:00Z");
        const obj = dt.toObject();
        obj.year = 2000;
        expect(dt.year).toBe(2026);
    });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe("clamp", () => {
    const min = new Badger("2026-01-01T00:00:00Z");
    const max = new Badger("2026-12-31T00:00:00Z");

    it("date within range → unchanged", () => {
        const mid = new Badger("2026-06-15T00:00:00Z");
        expect(mid.clamp(min, max).toISOString()).toBe(mid.toISOString());
    });

    it("date before min → clamped to min", () => {
        const before = new Badger("2025-06-15T00:00:00Z");
        expect(before.clamp(min, max).toISOString()).toBe(min.toISOString());
    });

    it("date after max → clamped to max", () => {
        const after = new Badger("2027-06-15T00:00:00Z");
        expect(after.clamp(min, max).toISOString()).toBe(max.toISOString());
    });

    it("date equal to min → returns min", () => {
        expect(min.clamp(min, max).toISOString()).toBe(min.toISOString());
    });

    it("date equal to max → returns max", () => {
        expect(max.clamp(min, max).toISOString()).toBe(max.toISOString());
    });

    it("does not mutate original", () => {
        const before = new Badger("2025-06-15T00:00:00Z");
        before.clamp(min, max);
        expect(before.year).toBe(2025);
    });

    it("accepts native Date for min and max", () => {
        const before = new Badger("2025-06-15T00:00:00Z");
        const result = before.clamp(new Date("2026-01-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));
        expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("accepts native Date for max", () => {
        const after = new Badger("2027-06-15T00:00:00Z");
        const result = after.clamp(new Date("2026-01-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));
        expect(result.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    });

    it("inverted range (min > max) throws RangeError", () => {
        const tooLateMin = new Badger("2026-12-31T00:00:00Z");
        const tooEarlyMax = new Badger("2026-01-01T00:00:00Z");
        expect(() => new Badger("2026-06-15T00:00:00Z").clamp(tooLateMin, tooEarlyMax)).toThrow(RangeError);
    });
});

// ─── Badger.min / Badger.max ─────────────────────────────────────────────────

describe("Badger.min / Badger.max", () => {
    const a = new Badger("2026-01-01T00:00:00Z");
    const b = new Badger("2026-06-15T00:00:00Z");
    const c = new Badger("2026-12-31T00:00:00Z");

    it("min — returns the earliest", () => expect(Badger.min(b, a, c).toISOString()).toBe(a.toISOString()));
    it("min — single argument returns itself", () => expect(Badger.min(b).toISOString()).toBe(b.toISOString()));
    it("min — equal dates returns one of them", () => {
        const x = new Badger("2026-06-15T00:00:00Z");
        expect(Badger.min(b, x).toISOString()).toBe(b.toISOString());
    });

    it("max — returns the latest", () => expect(Badger.max(b, a, c).toISOString()).toBe(c.toISOString()));
    it("max — single argument returns itself", () => expect(Badger.max(b).toISOString()).toBe(b.toISOString()));
    it("max — equal dates returns one of them", () => {
        const x = new Badger("2026-06-15T00:00:00Z");
        expect(Badger.max(b, x).toISOString()).toBe(b.toISOString());
    });
});

// ─── set ──────────────────────────────────────────────────────────────────────

describe("set", () => {
    const dt = new Badger("2026-06-15T10:30:45.123Z");

    it("set year", () => expect(dt.set("year", 2030).year).toBe(2030));
    it("set month", () => expect(dt.set("month", 12).month).toBe(12));
    it("set day", () => expect(dt.set("day", 1).day).toBe(1));
    it("set hour", () => expect(dt.set("hour", 9).hour).toBe(9));
    it("set minute", () => expect(dt.set("minute", 0).minute).toBe(0));
    it("set second", () => expect(dt.set("second", 59).second).toBe(59));
    it("set millisecond", () => expect(dt.set("millisecond", 0).millisecond).toBe(0));

    it("does not mutate the original", () => {
        dt.set("year", 2099);
        expect(dt.year).toBe(2026);
    });

    it("set year from leap day clamps to Feb 28 on non-leap year", () => {
        const leapDay = new Badger("2024-02-29T00:00:00Z");
        const result = leapDay.set("year", 2026);
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("set month to Feb on Jan 31 clamps to Feb 28", () => {
        const jan31 = new Badger("2026-01-31T00:00:00Z");
        const result = jan31.set("month", 2);
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("set month is 1-indexed (1 = January)", () => {
        expect(dt.set("month", 1).month).toBe(1);
    });

    it("set month 0 throws RangeError", () => {
        expect(() => dt.set("month", 0)).toThrow(RangeError);
    });

    it("set month 13 throws RangeError", () => {
        expect(() => dt.set("month", 13)).toThrow(RangeError);
    });

    it("set day 0 throws RangeError", () => {
        expect(() => dt.set("day", 0)).toThrow(RangeError);
    });

    it("set day 32 throws RangeError", () => {
        expect(() => dt.set("day", 32)).toThrow(RangeError);
    });

    it("set hour -1 throws RangeError", () => {
        expect(() => dt.set("hour", -1)).toThrow(RangeError);
    });

    it("set hour 24 throws RangeError", () => {
        expect(() => dt.set("hour", 24)).toThrow(RangeError);
    });

    it("set minute 60 throws RangeError", () => {
        expect(() => dt.set("minute", 60)).toThrow(RangeError);
    });

    it("set second 60 throws RangeError", () => {
        expect(() => dt.set("second", 60)).toThrow(RangeError);
    });

    it("set millisecond 1000 throws RangeError", () => {
        expect(() => dt.set("millisecond", 1000)).toThrow(RangeError);
    });

    it("set millisecond -1 throws RangeError", () => {
        expect(() => dt.set("millisecond", -1)).toThrow(RangeError);
    });

    it("set day 31 on Feb clamps to Feb 28 (non-leap)", () => {
        const feb = new Badger("2026-02-15T00:00:00Z");
        const result = feb.set("day", 31);
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("set day 31 on Feb clamps to Feb 29 (leap)", () => {
        const feb = new Badger("2024-02-15T00:00:00Z");
        const result = feb.set("day", 31);
        expect(result.month).toBe(2);
        expect(result.day).toBe(29);
    });

    it("set day 31 on April (30 days) clamps to Apr 30", () => {
        const apr = new Badger("2026-04-10T00:00:00Z");
        const result = apr.set("day", 31);
        expect(result.month).toBe(4);
        expect(result.day).toBe(30);
    });

    it("set day 30 on Feb clamps to Feb 28 (non-leap)", () => {
        const feb = new Badger("2026-02-01T00:00:00Z");
        const result = feb.set("day", 30);
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("set day 29 on Feb 2026 (non-leap) clamps to Feb 28", () => {
        const feb = new Badger("2026-02-01T00:00:00Z");
        const result = feb.set("day", 29);
        expect(result.month).toBe(2);
        expect(result.day).toBe(28);
    });

    it("set day 29 on Feb 2024 (leap) succeeds — returns Feb 29", () => {
        const feb = new Badger("2024-02-15T00:00:00Z");
        const result = feb.set("day", 29);
        expect(result.month).toBe(2);
        expect(result.day).toBe(29);
    });

    it("set day 31 on a 31-day month works normally", () => {
        const jan = new Badger("2026-01-15T00:00:00Z");
        const result = jan.set("day", 31);
        expect(result.month).toBe(1);
        expect(result.day).toBe(31);
    });
});

// ─── daysInYear ───────────────────────────────────────────────────────────────

describe("daysInYear", () => {
    it("non-leap year → 365", () => expect(new Badger("2026-06-15T00:00:00Z").daysInYear()).toBe(365));
    it("leap year → 366", () => expect(new Badger("2024-06-15T00:00:00Z").daysInYear()).toBe(366));
    it("century non-leap → 365", () => expect(new Badger("1900-01-01T00:00:00Z").daysInYear()).toBe(365));
    it("400-year leap → 366", () => expect(new Badger("2000-06-15T00:00:00Z").daysInYear()).toBe(366));
    it("invalid date → NaN (not 365, which isLeapYear returns false for NaN)", () => {
        expect(new Badger("not-a-date").daysInYear()).toBeNaN();
    });
});

// ─── startOf/endOf quarter ────────────────────────────────────────────────────

describe("startOf / endOf quarter", () => {
    it("startOf quarter — Q1 mid → Jan 1 midnight", () => {
        expect(new Badger("2026-02-15T12:00:00Z").startOf("quarter").toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
    it("startOf quarter — Q2 mid → Apr 1 midnight", () => {
        expect(new Badger("2026-05-20T12:00:00Z").startOf("quarter").toISOString()).toBe("2026-04-01T00:00:00.000Z");
    });
    it("startOf quarter — Q3 mid → Jul 1 midnight", () => {
        expect(new Badger("2026-08-10T12:00:00Z").startOf("quarter").toISOString()).toBe("2026-07-01T00:00:00.000Z");
    });
    it("startOf quarter — Q4 mid → Oct 1 midnight", () => {
        expect(new Badger("2026-11-05T12:00:00Z").startOf("quarter").toISOString()).toBe("2026-10-01T00:00:00.000Z");
    });
    it("startOf quarter — already on first day of quarter", () => {
        expect(new Badger("2026-04-01T15:00:00Z").startOf("quarter").toISOString()).toBe("2026-04-01T00:00:00.000Z");
    });

    it("endOf quarter — Q1 mid → Mar 31 23:59:59.999", () => {
        expect(new Badger("2026-02-15T12:00:00Z").endOf("quarter").toISOString()).toBe("2026-03-31T23:59:59.999Z");
    });
    it("endOf quarter — Q2 mid → Jun 30 23:59:59.999", () => {
        expect(new Badger("2026-05-20T12:00:00Z").endOf("quarter").toISOString()).toBe("2026-06-30T23:59:59.999Z");
    });
    it("endOf quarter — Q3 mid → Sep 30 23:59:59.999", () => {
        expect(new Badger("2026-08-10T12:00:00Z").endOf("quarter").toISOString()).toBe("2026-09-30T23:59:59.999Z");
    });
    it("endOf quarter — Q4 mid → Dec 31 23:59:59.999", () => {
        expect(new Badger("2026-11-05T12:00:00Z").endOf("quarter").toISOString()).toBe("2026-12-31T23:59:59.999Z");
    });
});

// ─── quarter ──────────────────────────────────────────────────────────────────

describe("quarter", () => {
    it("Jan → Q1", () => expect(new Badger("2026-01-01T00:00:00Z").quarter).toBe(1));
    it("Mar → Q1", () => expect(new Badger("2026-03-31T00:00:00Z").quarter).toBe(1));
    it("Apr → Q2", () => expect(new Badger("2026-04-01T00:00:00Z").quarter).toBe(2));
    it("Jun → Q2", () => expect(new Badger("2026-06-30T00:00:00Z").quarter).toBe(2));
    it("Jul → Q3", () => expect(new Badger("2026-07-01T00:00:00Z").quarter).toBe(3));
    it("Sep → Q3", () => expect(new Badger("2026-09-30T00:00:00Z").quarter).toBe(3));
    it("Oct → Q4", () => expect(new Badger("2026-10-01T00:00:00Z").quarter).toBe(4));
    it("Dec → Q4", () => expect(new Badger("2026-12-31T00:00:00Z").quarter).toBe(4));
});

// ─── weekYear ─────────────────────────────────────────────────────────────────

describe("weekYear", () => {
    it("mid-year — week year matches calendar year", () => expect(new Badger("2026-06-15T00:00:00Z").weekYear).toBe(2026));
    it("Jan 1 2021 (Fri) — belongs to week 53 of 2020", () => expect(new Badger("2021-01-01T00:00:00Z").weekYear).toBe(2020));
    it("Dec 31 2020 (Thu) — belongs to week 53 of 2020", () => expect(new Badger("2020-12-31T00:00:00Z").weekYear).toBe(2020));
    it("Jan 4 2021 (Mon) — week 1 of 2021", () => expect(new Badger("2021-01-04T00:00:00Z").weekYear).toBe(2021));
    it("Dec 28 2026 (Mon) — week 53, still 2026", () => expect(new Badger("2026-12-28T00:00:00Z").weekYear).toBe(2026));
});

// ─── dayOfYear ────────────────────────────────────────────────────────────────

describe("dayOfYear", () => {
    it("Jan 1 → 1", () => expect(new Badger("2026-01-01T00:00:00Z").dayOfYear).toBe(1));
    it("Dec 31 non-leap → 365", () => expect(new Badger("2026-12-31T00:00:00Z").dayOfYear).toBe(365));
    it("Dec 31 leap year → 366", () => expect(new Badger("2024-12-31T00:00:00Z").dayOfYear).toBe(366));
    it("Jun 15 2026 → 166", () => expect(new Badger("2026-06-15T00:00:00Z").dayOfYear).toBe(166));
    it("Feb 28 non-leap → 59", () => expect(new Badger("2026-02-28T00:00:00Z").dayOfYear).toBe(59));
    it("Feb 29 leap → 60", () => expect(new Badger("2024-02-29T00:00:00Z").dayOfYear).toBe(60));
    it("Mar 1 non-leap → 60", () => expect(new Badger("2026-03-01T00:00:00Z").dayOfYear).toBe(60));
    it("Mar 1 leap → 61", () => expect(new Badger("2024-03-01T00:00:00Z").dayOfYear).toBe(61));
});

// ─── isPast / isFuture ────────────────────────────────────────────────────────

describe("isPast / isFuture", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("isPast — true for a past date", () => expect(new Badger("2026-06-14T00:00:00Z").isPast()).toBe(true));
    it("isPast — false for a future date", () => expect(new Badger("2026-06-16T00:00:00Z").isPast()).toBe(false));
    it("isPast — false for exact now", () => expect(new Badger("2026-06-15T12:00:00Z").isPast()).toBe(false));

    it("isFuture — true for a future date", () => expect(new Badger("2026-06-16T00:00:00Z").isFuture()).toBe(true));
    it("isFuture — false for a past date", () => expect(new Badger("2026-06-14T00:00:00Z").isFuture()).toBe(false));
    it("isFuture — false for exact now", () => expect(new Badger("2026-06-15T12:00:00Z").isFuture()).toBe(false));
});

// ─── isSameOrBefore / isSameOrAfter ──────────────────────────────────────────

describe("isSameOrBefore / isSameOrAfter", () => {
    const earlier = new Badger("2026-01-01T00:00:00Z");
    const same    = new Badger("2026-06-15T00:00:00Z");
    const later   = new Badger("2026-12-31T00:00:00Z");

    it("isSameOrBefore — true when before", () => expect(earlier.isSameOrBefore(same)).toBe(true));
    it("isSameOrBefore — true when equal", () => expect(same.isSameOrBefore(new Badger("2026-06-15T00:00:00Z"))).toBe(true));
    it("isSameOrBefore — false when after", () => expect(later.isSameOrBefore(same)).toBe(false));

    it("isSameOrAfter — true when after", () => expect(later.isSameOrAfter(same)).toBe(true));
    it("isSameOrAfter — true when equal", () => expect(same.isSameOrAfter(new Badger("2026-06-15T00:00:00Z"))).toBe(true));
    it("isSameOrAfter — false when before", () => expect(earlier.isSameOrAfter(same)).toBe(false));

    it("isSameOrBefore accepts native Date", () => {
        expect(earlier.isSameOrBefore(new Date("2026-06-15T00:00:00Z"))).toBe(true);
    });

    it("isSameOrAfter accepts native Date", () => {
        expect(later.isSameOrAfter(new Date("2026-06-15T00:00:00Z"))).toBe(true);
    });

    // with unit granularity
    it("isSameOrBefore with unit — same day, later time → true", () => {
        const a = new Badger("2026-06-15T08:00:00Z");
        const b = new Badger("2026-06-15T22:00:00Z");
        expect(a.isSameOrBefore(b, "day")).toBe(true);
    });

    it("isSameOrBefore with unit — same month, earlier day → true", () => {
        const a = new Badger("2026-06-01T00:00:00Z");
        const b = new Badger("2026-06-30T00:00:00Z");
        expect(a.isSameOrBefore(b, "month")).toBe(true);
    });

    it("isSameOrBefore with unit — same month different times → true (same granularity)", () => {
        const a = new Badger("2026-06-30T23:59:59Z");
        const b = new Badger("2026-06-01T00:00:00Z");
        expect(a.isSameOrBefore(b, "month")).toBe(true);
    });

    it("isSameOrAfter with unit — same day, earlier time → true", () => {
        const a = new Badger("2026-06-15T22:00:00Z");
        const b = new Badger("2026-06-15T08:00:00Z");
        expect(a.isSameOrAfter(b, "day")).toBe(true);
    });

    it("isSameOrAfter with unit — different month → false", () => {
        const a = new Badger("2026-05-31T00:00:00Z");
        const b = new Badger("2026-06-01T00:00:00Z");
        expect(a.isSameOrAfter(b, "month")).toBe(false);
    });

    it("isSameOrBefore with unit — strictly before (isSame false, isBefore true)", () => {
        const a = new Badger("2026-05-15T00:00:00Z");
        const b = new Badger("2026-06-01T00:00:00Z");
        expect(a.isSameOrBefore(b, "month")).toBe(true);
    });

    it("isSameOrAfter with unit — strictly after (isSame false, isAfter true)", () => {
        const a = new Badger("2026-07-01T00:00:00Z");
        const b = new Badger("2026-06-30T00:00:00Z");
        expect(a.isSameOrAfter(b, "month")).toBe(true);
    });
});

// ─── second unit in add / subtract / diff ─────────────────────────────────────

describe("second as a unit", () => {
    it("add seconds", () => {
        expect(new Badger("2026-06-15T10:00:00.000Z").add(90, "second").toISOString())
            .toBe("2026-06-15T10:01:30.000Z");
    });

    it("subtract seconds", () => {
        expect(new Badger("2026-06-15T10:01:30.000Z").subtract(90, "second").toISOString())
            .toBe("2026-06-15T10:00:00.000Z");
    });

    it("add seconds across minute boundary", () => {
        expect(new Badger("2026-06-15T10:00:50.000Z").add(15, "second").toISOString())
            .toBe("2026-06-15T10:01:05.000Z");
    });

    it("diff in seconds — positive when this > other", () => {
        const a = new Badger("2026-06-15T10:01:30.000Z");
        const b = new Badger("2026-06-15T10:00:00.000Z");
        expect(a.diff(b, "second")).toBe(90);
    });

    it("diff in seconds — floors partial seconds", () => {
        const a = new Badger("2026-06-15T10:00:01.999Z");
        const b = new Badger("2026-06-15T10:00:00.000Z");
        expect(a.diff(b, "second")).toBe(1);
    });

    it("startOf('second') zeros milliseconds", () => {
        const dt = new Badger("2026-06-15T10:30:45.999Z").startOf("second");
        expect(dt.toISOString()).toBe("2026-06-15T10:30:45.000Z");
    });

    it("endOf('second') sets ms to 999", () => {
        const dt = new Badger("2026-06-15T10:30:45.000Z").endOf("second");
        expect(dt.toISOString()).toBe("2026-06-15T10:30:45.999Z");
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

// ─── Badger.range ────────────────────────────────────────────────────────────
// Returns an array of Badger instances from start (inclusive) to end (exclusive).
// Each step is one unit apart. Consistent with isBetween — end is not included.

describe("Badger.range", () => {
    it("returns daily steps between two dates", () => {
        const result = Badger.range("2026-06-01", "2026-06-05", "day");
        expect(result).toHaveLength(4);
        expect(result[0].toISOString()).toBe("2026-06-01T00:00:00.000Z");
        expect(result[1].toISOString()).toBe("2026-06-02T00:00:00.000Z");
        expect(result[2].toISOString()).toBe("2026-06-03T00:00:00.000Z");
        expect(result[3].toISOString()).toBe("2026-06-04T00:00:00.000Z");
    });

    it("end date is excluded", () => {
        const result = Badger.range("2026-06-01", "2026-06-03", "day");
        expect(result).toHaveLength(2);
        expect(result.map(d => d.toISOString())).not.toContain("2026-06-03T00:00:00.000Z");
    });

    it("returns weekly steps", () => {
        const result = Badger.range("2026-06-01", "2026-06-22", "week");
        expect(result).toHaveLength(3);
        expect(result[0].toISOString()).toBe("2026-06-01T00:00:00.000Z");
        expect(result[1].toISOString()).toBe("2026-06-08T00:00:00.000Z");
        expect(result[2].toISOString()).toBe("2026-06-15T00:00:00.000Z");
    });

    it("returns monthly steps", () => {
        const result = Badger.range("2026-01-01", "2026-04-01", "month");
        expect(result).toHaveLength(3);
        expect(result[0].toISOString()).toBe("2026-01-01T00:00:00.000Z");
        expect(result[1].toISOString()).toBe("2026-02-01T00:00:00.000Z");
        expect(result[2].toISOString()).toBe("2026-03-01T00:00:00.000Z");
    });

    it("returns empty array when start equals end", () => {
        const result = Badger.range("2026-06-01", "2026-06-01", "day");
        expect(result).toHaveLength(0);
    });

    it("returns empty array when start is after end", () => {
        const result = Badger.range("2026-06-05", "2026-06-01", "day");
        expect(result).toHaveLength(0);
    });

    it("accepts Badger instances as start and end", () => {
        const start = new Badger("2026-06-01");
        const end   = new Badger("2026-06-04");
        const result = Badger.range(start, end, "day");
        expect(result).toHaveLength(3);
        expect(result[0].toISOString()).toBe("2026-06-01T00:00:00.000Z");
    });

    it("accepts Date objects as start and end", () => {
        const start = new Date("2026-06-01T00:00:00Z");
        const end   = new Date("2026-06-04T00:00:00Z");
        const result = Badger.range(start, end, "day");
        expect(result).toHaveLength(3);
    });

    it("each element is a Badger instance", () => {
        const result = Badger.range("2026-06-01", "2026-06-04", "day");
        result.forEach(d => expect(d).toBeInstanceOf(Badger));
    });

    it("single day range returns one element", () => {
        const result = Badger.range("2026-06-01", "2026-06-02", "day");
        expect(result).toHaveLength(1);
        expect(result[0].toISOString()).toBe("2026-06-01T00:00:00.000Z");
    });

    it("always normalises each step to midnight UTC regardless of start time", () => {
        const result = Badger.range("2026-06-01T09:30:00Z", "2026-06-04T09:30:00Z", "day");
        expect(result).toHaveLength(3);
        expect(result[0].toISOString()).toBe("2026-06-01T00:00:00.000Z");
        expect(result[1].toISOString()).toBe("2026-06-02T00:00:00.000Z");
        expect(result[2].toISOString()).toBe("2026-06-03T00:00:00.000Z");
    });

    it("end boundary is day-level — time on end date does not pull in an extra day", () => {
        // end is Jun 4 at 09:30 — Jun 4 midnight should NOT be included
        const result = Badger.range("2026-06-01T00:00:00Z", "2026-06-04T09:30:00Z", "day");
        expect(result).toHaveLength(3);
        expect(result[result.length - 1].toISOString()).toBe("2026-06-03T00:00:00.000Z");
    });

    it("week range does not strip time — preserves input time across steps", () => {
        const result = Badger.range("2026-06-01T09:30:00Z", "2026-06-22T09:30:00Z", "week");
        expect(result).toHaveLength(3);
        expect(result[0].toISOString()).toBe("2026-06-01T09:30:00.000Z");
        expect(result[1].toISOString()).toBe("2026-06-08T09:30:00.000Z");
        expect(result[2].toISOString()).toBe("2026-06-15T09:30:00.000Z");
    });

    it("month range preserves day-of-month across steps", () => {
        const result = Badger.range("2026-01-15T00:00:00Z", "2026-04-15T00:00:00Z", "month");
        expect(result).toHaveLength(3);
        expect(result[0].toISOString()).toBe("2026-01-15T00:00:00.000Z");
        expect(result[1].toISOString()).toBe("2026-02-15T00:00:00.000Z");
        expect(result[2].toISOString()).toBe("2026-03-15T00:00:00.000Z");
    });
});

// ─── countdown ───────────────────────────────────────────────────────────────
// Returns { days, hours, minutes, seconds } remaining until this date.
// All values are non-negative whole numbers.
// Optionally pass a relativeTo date — defaults to now.

describe("countdown", () => {
    it("returns correct days, hours, minutes, seconds for a future date", () => {
        const target = new Badger("2026-06-17T02:30:45Z");
        const anchor = new Badger("2026-06-15T00:00:00Z");
        expect(target.countdown(anchor.toDate())).toEqual({ days: 2, hours: 2, minutes: 30, seconds: 45 });
    });

    it("exactly one day remaining", () => {
        const target = new Badger("2026-06-16T00:00:00Z");
        const anchor = new Badger("2026-06-15T00:00:00Z");
        expect(target.countdown(anchor.toDate())).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0 });
    });

    it("less than one hour remaining", () => {
        const target = new Badger("2026-06-15T00:45:30Z");
        const anchor = new Badger("2026-06-15T00:00:00Z");
        expect(target.countdown(anchor.toDate())).toEqual({ days: 0, hours: 0, minutes: 45, seconds: 30 });
    });

    it("returns null when target equals anchor — countdown is over", () => {
        const target = new Badger("2026-06-15T00:00:00Z");
        expect(target.countdown(new Date("2026-06-15T00:00:00Z"))).toBeNull();
    });

    it("returns null when target is in the past", () => {
        const target = new Badger("2026-06-14T00:00:00Z");
        const anchor = new Badger("2026-06-15T00:00:00Z");
        expect(target.countdown(anchor.toDate())).toBeNull();
    });

    it("hours, minutes, seconds do not overflow their unit", () => {
        const target = new Badger("2026-06-16T01:01:01Z");
        const anchor = new Badger("2026-06-15T00:00:00Z");
        const result = target.countdown(anchor.toDate())!;
        expect(result.hours).toBeLessThan(24);
        expect(result.minutes).toBeLessThan(60);
        expect(result.seconds).toBeLessThan(60);
        expect(result).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    });

    it("result keys are always whole numbers", () => {
        const target = new Badger("2026-06-17T02:30:45Z");
        const anchor = new Badger("2026-06-15T00:00:00Z");
        const result = target.countdown(anchor.toDate())!;
        Object.values(result).forEach(v => expect(Number.isInteger(v)).toBe(true));
    });

    it("no arg defaults to now — future date returns non-null countdown", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
        const result = new Badger("2026-06-16T00:00:00Z").countdown();
        expect(result).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0 });
        vi.useRealTimers();
    });

    it("no arg defaults to now — past date returns null", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
        const result = new Badger("2026-06-14T00:00:00Z").countdown();
        expect(result).toBeNull();
        vi.useRealTimers();
    });
});

// ─── isBusinessDay ────────────────────────────────────────────────────────────
// June 2026: Mon=8, Tue=9, Wed=10, Thu=11, Fri=12, Sat=13, Sun=14
// en-GB weekend: Sat+Sun (ISO 6,7)
// ar-SA weekend: Fri+Sat (ISO 5,6) — Sunday is a workday

describe("isBusinessDay", () => {
    it("Monday is a business day (en-GB)", () => {
        expect(new Badger("2026-06-08T12:00:00Z").isBusinessDay()).toBe(true);
    });

    it("Friday is a business day (en-GB)", () => {
        expect(new Badger("2026-06-12T12:00:00Z").isBusinessDay()).toBe(true);
    });

    it("Saturday is not a business day (en-GB)", () => {
        expect(new Badger("2026-06-13T12:00:00Z").isBusinessDay()).toBe(false);
    });

    it("Sunday is not a business day (en-GB)", () => {
        expect(new Badger("2026-06-14T12:00:00Z").isBusinessDay()).toBe(false);
    });

    it("Friday is not a business day (ar-SA)", () => {
        expect(new Badger("2026-06-12T12:00:00Z").isBusinessDay(new Intl.Locale("ar-SA"))).toBe(false);
    });

    it("Saturday is not a business day (ar-SA)", () => {
        expect(new Badger("2026-06-13T12:00:00Z").isBusinessDay(new Intl.Locale("ar-SA"))).toBe(false);
    });

    it("Sunday is a business day (ar-SA)", () => {
        expect(new Badger("2026-06-14T12:00:00Z").isBusinessDay(new Intl.Locale("ar-SA"))).toBe(true);
    });

    it("Monday is a business day (ar-SA)", () => {
        expect(new Badger("2026-06-08T12:00:00Z").isBusinessDay(new Intl.Locale("ar-SA"))).toBe(true);
    });
});

// ─── addBusinessDays ──────────────────────────────────────────────────────────
// Starting Mon Jun 8:
//   +1 = Tue Jun 9, +5 = Mon Jun 15, +6 = Tue Jun 16
// Starting Thu Jun 11:
//   +1 = Fri Jun 12, +2 = Mon Jun 15  (skips Sat+Sun)
// Starting Fri Jun 12:
//   +1 = Mon Jun 15  (skips Sat+Sun)

describe("addBusinessDays", () => {
    it("adds 1 business day from Monday", () => {
        expect(new Badger("2026-06-08T12:00:00Z").addBusinessDays(1).toISOString())
            .toBe("2026-06-09T12:00:00.000Z");
    });

    it("adds 5 business days from Monday — lands on next Monday", () => {
        expect(new Badger("2026-06-08T12:00:00Z").addBusinessDays(5).toISOString())
            .toBe("2026-06-15T12:00:00.000Z");
    });

    it("skips the weekend when crossing from Thursday", () => {
        expect(new Badger("2026-06-11T12:00:00Z").addBusinessDays(2).toISOString())
            .toBe("2026-06-15T12:00:00.000Z");
    });

    it("skips the weekend when adding 1 from Friday", () => {
        expect(new Badger("2026-06-12T12:00:00Z").addBusinessDays(1).toISOString())
            .toBe("2026-06-15T12:00:00.000Z");
    });

    it("adding 0 business days returns the same day if it is a business day", () => {
        expect(new Badger("2026-06-08T12:00:00Z").addBusinessDays(0).toISOString())
            .toBe("2026-06-08T12:00:00.000Z");
    });

    it("skips Friday when adding from Thursday (ar-SA)", () => {
        // Thu Jun 11 + 1 business day ar-SA → Sun Jun 14 (skips Fri+Sat)
        expect(new Badger("2026-06-11T12:00:00Z").addBusinessDays(1, new Intl.Locale("ar-SA")).toISOString())
            .toBe("2026-06-14T12:00:00.000Z");
    });

    it("preserves time of day", () => {
        expect(new Badger("2026-06-08T09:30:00Z").addBusinessDays(1).toISOString())
            .toBe("2026-06-09T09:30:00.000Z");
    });
});

// ─── subtractBusinessDays ─────────────────────────────────────────────────────
// Starting Mon Jun 15:
//   -1 = Fri Jun 12, -5 = Mon Jun 8
// Starting Mon Jun 8:
//   -1 = Fri Jun 5  (skips Sat+Sun going backwards)

describe("subtractBusinessDays", () => {
    it("subtracts 1 business day from Monday — lands on Friday", () => {
        expect(new Badger("2026-06-15T12:00:00Z").subtractBusinessDays(1).toISOString())
            .toBe("2026-06-12T12:00:00.000Z");
    });

    it("subtracts 5 business days from Monday — lands on previous Monday", () => {
        expect(new Badger("2026-06-15T12:00:00Z").subtractBusinessDays(5).toISOString())
            .toBe("2026-06-08T12:00:00.000Z");
    });

    it("skips the weekend going backwards from Monday", () => {
        expect(new Badger("2026-06-08T12:00:00Z").subtractBusinessDays(1).toISOString())
            .toBe("2026-06-05T12:00:00.000Z");
    });

    it("subtracting 0 business days returns the same day", () => {
        expect(new Badger("2026-06-08T12:00:00Z").subtractBusinessDays(0).toISOString())
            .toBe("2026-06-08T12:00:00.000Z");
    });

    it("skips Friday+Saturday going backwards (ar-SA)", () => {
        // Sun Jun 14 - 1 business day ar-SA → Thu Jun 11 (skips Sat+Fri going back)
        expect(new Badger("2026-06-14T12:00:00Z").subtractBusinessDays(1, new Intl.Locale("ar-SA")).toISOString())
            .toBe("2026-06-11T12:00:00.000Z");
    });

    it("preserves time of day", () => {
        expect(new Badger("2026-06-15T09:30:00Z").subtractBusinessDays(1).toISOString())
            .toBe("2026-06-12T09:30:00.000Z");
    });
});

// ─── Business days — global locale fallback ───────────────────────────────────
// When no locale is passed, should fall back to BadgerSettings.defaultLocale
// before hardcoding Sat+Sun.

describe("business days — BadgerSettings.defaultLocale fallback", () => {
    afterEach(() => BadgerSettings.reset());

    it("isBusinessDay() uses defaultLocale when no locale arg is passed", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("ar-SA");
        // Friday — weekend in ar-SA, business day in en-GB
        expect(new Badger("2026-06-12T12:00:00Z").isBusinessDay()).toBe(false);
    });

    it("isBusinessDay() explicit locale arg overrides defaultLocale", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("ar-SA");
        // Friday — pass en-GB explicitly, should be a business day
        expect(new Badger("2026-06-12T12:00:00Z").isBusinessDay(new Intl.Locale("en-GB"))).toBe(true);
    });

    it("addBusinessDays() uses defaultLocale when no locale arg is passed", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("ar-SA");
        // Thu Jun 11 + 1 business day ar-SA → Sun Jun 14 (skips Fri+Sat)
        expect(new Badger("2026-06-11T12:00:00Z").addBusinessDays(1).toISOString())
            .toBe("2026-06-14T12:00:00.000Z");
    });

    it("subtractBusinessDays() uses defaultLocale when no locale arg is passed", () => {
        BadgerSettings.defaultLocale = new Intl.Locale("ar-SA");
        // Sun Jun 14 - 1 business day ar-SA → Thu Jun 11 (skips Sat+Fri going back)
        expect(new Badger("2026-06-14T12:00:00Z").subtractBusinessDays(1).toISOString())
            .toBe("2026-06-11T12:00:00.000Z");
    });

    it("falls back to Sat+Sun when no locale arg and no defaultLocale", () => {
        // No global locale set — Friday should be a business day
        expect(new Badger("2026-06-12T12:00:00Z").isBusinessDay()).toBe(true);
    });
});

// ─── Audit fixes ──────────────────────────────────────────────────────────────

describe("Badger.min / Badger.max — empty args", () => {
    it("min() with no arguments throws RangeError", () => {
        expect(() => (Badger.min as any)()).toThrow(RangeError);
    });

    it("max() with no arguments throws RangeError", () => {
        expect(() => (Badger.max as any)()).toThrow(RangeError);
    });

    it("min() with a single argument returns that argument", () => {
        const dt = new Badger("2026-06-15T12:00:00Z");
        expect(Badger.min(dt).toISOString()).toBe(dt.toISOString());
    });

    it("max() with a single argument returns that argument", () => {
        const dt = new Badger("2026-06-15T12:00:00Z");
        expect(Badger.max(dt).toISOString()).toBe(dt.toISOString());
    });
});

describe("set() — NaN and Infinity guard", () => {
    const dt = new Badger("2026-06-15T12:30:45Z");

    it("set(hour, NaN) throws RangeError", () => {
        expect(() => dt.set("hour", NaN)).toThrow(RangeError);
    });

    it("set(hour, Infinity) throws RangeError", () => {
        expect(() => dt.set("hour", Infinity)).toThrow(RangeError);
    });

    it("set(year, NaN) throws RangeError", () => {
        expect(() => dt.set("year", NaN)).toThrow(RangeError);
    });

    it("set(minute, NaN) throws RangeError", () => {
        expect(() => dt.set("minute", NaN)).toThrow(RangeError);
    });

    it("set(year, 2030) still works normally", () => {
        expect(dt.set("year", 2030).year).toBe(2030);
    });
});

describe("addBusinessDays / subtractBusinessDays — negative n", () => {
    const dt = new Badger("2026-06-15T12:00:00Z");

    it("addBusinessDays(-1) throws RangeError", () => {
        expect(() => dt.addBusinessDays(-1)).toThrow(RangeError);
    });

    it("subtractBusinessDays(-1) throws RangeError", () => {
        expect(() => dt.subtractBusinessDays(-1)).toThrow(RangeError);
    });

    it("addBusinessDays(0) still returns same date", () => {
        expect(dt.addBusinessDays(0).toISOString()).toBe(dt.toISOString());
    });

    it("subtractBusinessDays(0) still returns same date", () => {
        expect(dt.subtractBusinessDays(0).toISOString()).toBe(dt.toISOString());
    });
});

describe("startOf / endOf millisecond — explicit no-op", () => {
    const dt = new Badger("2026-06-15T12:30:45.500Z");

    it("startOf(millisecond) returns an independent clone at the same instant", () => {
        const result = dt.startOf("millisecond");
        expect(result.toISOString()).toBe(dt.toISOString());
        expect(result).not.toBe(dt); // different instance
    });

    it("endOf(millisecond) returns an independent clone at the same instant", () => {
        const result = dt.endOf("millisecond");
        expect(result.toISOString()).toBe(dt.toISOString());
        expect(result).not.toBe(dt);
    });
});

// ─── Runtime guard: unknown unit strings ─────────────────────────────────────
// TypeScript enforces UnitOfTime at compile time, but runtime JS callers can
// pass anything. Every switch that dispatches on a unit now has a default that
// throws TypeError so callers get an explicit error instead of a silent no-op.

describe("unknown unit — runtime TypeError guards", () => {
    const dt = new Badger("2026-06-15T12:30:45.500Z");

    it("startOf with unknown unit throws TypeError", () => {
        expect(() => (dt as any).startOf("fortnight")).toThrow(TypeError);
    });

    it("endOf with unknown unit throws TypeError", () => {
        expect(() => (dt as any).endOf("fortnight")).toThrow(TypeError);
    });

    it("add (via _addUnit) with unknown unit throws TypeError", () => {
        expect(() => (dt as any)._addUnit(1, "fortnight")).toThrow(TypeError);
    });

    it("set with unknown unit throws TypeError", () => {
        expect(() => (dt as any).set("fortnight", 1)).toThrow(TypeError);
    });
});

// ─── Runtime guard: add / subtract with missing unit ─────────────────────────
// Calling add(number) or subtract(number) without a unit is a silent no-op at
// runtime. Both now throw TypeError immediately to surface the mistake.

describe("add / subtract — missing unit guard", () => {
    const dt = new Badger("2026-06-15T12:00:00Z");

    it("add(number) without unit throws TypeError", () => {
        expect(() => (dt as any).add(5)).toThrow(TypeError);
    });

    it("subtract(number) without unit throws TypeError", () => {
        expect(() => (dt as any).subtract(5)).toThrow(TypeError);
    });

    it("add(number, unit) still works normally", () => {
        expect(dt.add(1, "day").day).toBe(16);
    });

    it("subtract(number, unit) still works normally", () => {
        expect(dt.subtract(1, "day").day).toBe(14);
    });
});

// ─── Runtime guard: countdown on invalid Badger ───────────────────────────────
// An invalid Badger (e.g. constructed from a bad string) previously returned
// { days: NaN, ... } because NaN <= 0 is false. It now returns null immediately.

describe("countdown — invalid Badger guard", () => {
    it("invalid Badger returns null, not a NaN object", () => {
        const invalid = new Badger("not-a-date");
        expect(invalid.isValid()).toBe(false);
        expect(invalid.countdown(new Date("2026-06-15T00:00:00Z"))).toBeNull();
    });

    it("invalid Badger returns null when called with no anchor", () => {
        const invalid = new Badger("not-a-date");
        expect(invalid.countdown()).toBeNull();
    });
});

// ─── Runtime guard: addBusinessDays / subtractBusinessDays with NaN ──────────
// Math.sign(NaN) < 0 is false, so NaN bypassed the old guard and produced a
// silent no-op. The check is now !Number.isFinite(n) || n < 0.

describe("addBusinessDays / subtractBusinessDays — NaN guard", () => {
    const dt = new Badger("2026-06-15T12:00:00Z");

    it("addBusinessDays(NaN) throws RangeError", () => {
        expect(() => dt.addBusinessDays(NaN)).toThrow(RangeError);
    });

    it("subtractBusinessDays(NaN) throws RangeError", () => {
        expect(() => dt.subtractBusinessDays(NaN)).toThrow(RangeError);
    });

    it("addBusinessDays(Infinity) throws RangeError", () => {
        expect(() => dt.addBusinessDays(Infinity)).toThrow(RangeError);
    });

    it("subtractBusinessDays(Infinity) throws RangeError", () => {
        expect(() => dt.subtractBusinessDays(Infinity)).toThrow(RangeError);
    });
});

// ─── Runtime guard: clamp / isBetween with invalid bounds ─────────────────────
// NaN > NaN is false, so invalid bounds previously slipped past the existing
// range checks and produced silent wrong-value results. Both now throw eagerly.

describe("clamp / isBetween — invalid bounds guard", () => {
    const dt = new Badger("2026-06-15T00:00:00Z");
    const validMin = new Badger("2026-01-01T00:00:00Z");
    const validMax = new Badger("2026-12-31T00:00:00Z");
    const invalidBadger = new Badger("not-a-date");
    const invalidDate = new Date("not-a-date");

    it("clamp: invalid Badger as min throws RangeError", () => {
        expect(() => dt.clamp(invalidBadger, validMax)).toThrow(RangeError);
    });

    it("clamp: invalid Badger as max throws RangeError", () => {
        expect(() => dt.clamp(validMin, invalidBadger)).toThrow(RangeError);
    });

    it("clamp: invalid Date as min throws RangeError", () => {
        expect(() => dt.clamp(invalidDate, new Date("2026-12-31T00:00:00Z"))).toThrow(RangeError);
    });

    it("clamp: invalid Date as max throws RangeError", () => {
        expect(() => dt.clamp(new Date("2026-01-01T00:00:00Z"), invalidDate)).toThrow(RangeError);
    });

    it("isBetween: invalid Badger as start throws RangeError", () => {
        expect(() => dt.isBetween(invalidBadger, validMax)).toThrow(RangeError);
    });

    it("isBetween: invalid Badger as end throws RangeError", () => {
        expect(() => dt.isBetween(validMin, invalidBadger)).toThrow(RangeError);
    });

    it("isBetween: invalid Date as start throws RangeError", () => {
        expect(() => dt.isBetween(invalidDate, new Date("2026-12-31T00:00:00Z"))).toThrow(RangeError);
    });

    it("isBetween: invalid Date as end throws RangeError", () => {
        expect(() => dt.isBetween(new Date("2026-01-01T00:00:00Z"), invalidDate)).toThrow(RangeError);
    });

    it("clamp still works normally with valid bounds", () => {
        const mid = new Badger("2026-06-15T00:00:00Z");
        expect(mid.clamp(validMin, validMax).toISOString()).toBe(mid.toISOString());
    });

    it("isBetween still works normally with valid bounds", () => {
        expect(dt.isBetween(validMin, validMax)).toBe(true);
    });
});

// ─── Constructor — empty string ───────────────────────────────────────────────
// "" is falsy. Old code fell through to the else-branch and returned current
// time. Now the typeof-string branch catches it and produces Invalid Date.

describe("constructor — empty string", () => {
    it('new Badger("") is invalid, not current time', () => {
        const dt = new Badger("");
        expect(dt.isValid()).toBe(false);
    });

    it("non-empty invalid string is still invalid", () => {
        expect(new Badger("not-a-date").isValid()).toBe(false);
    });

    it("valid string still works after the refactor", () => {
        expect(new Badger("2026-06-15T00:00:00Z").isValid()).toBe(true);
    });
});

// ─── fromLocal — format validation ───────────────────────────────────────────
// fromLocal now validates its two string arguments before parsing.

describe("fromLocal — format validation", () => {
    it('date missing dashes throws RangeError', () => {
        expect(() => Badger.fromLocal("20260615", "10:00")).toThrow(RangeError);
    });

    it('empty date string throws RangeError', () => {
        expect(() => Badger.fromLocal("", "10:00")).toThrow(RangeError);
    });

    it('time without colon throws RangeError', () => {
        expect(() => Badger.fromLocal("2026-06-15", "1000")).toThrow(RangeError);
    });

    it('empty time string throws RangeError', () => {
        expect(() => Badger.fromLocal("2026-06-15", "")).toThrow(RangeError);
    });

    it('valid inputs still work', () => {
        const dt = Badger.fromLocal("2026-06-15", "10:30");
        expect(dt.isValid()).toBe(true);
        expect(dt.hour).toBe(10);
        expect(dt.minute).toBe(30);
    });
});

// ─── Badger.range — invalid start / end ──────────────────────────────────────
// Previously returned [] silently. Now throws RangeError immediately.

describe("Badger.range — invalid date guards", () => {
    it("invalid start string throws RangeError", () => {
        expect(() => Badger.range("not-a-date", "2026-06-10", "day")).toThrow(RangeError);
    });

    it("invalid end string throws RangeError", () => {
        expect(() => Badger.range("2026-06-01", "not-a-date", "day")).toThrow(RangeError);
    });

    it("invalid Badger as start throws RangeError", () => {
        expect(() => Badger.range(new Badger("bad"), new Badger("2026-06-10"), "day")).toThrow(RangeError);
    });

    it("invalid Badger as end throws RangeError", () => {
        expect(() => Badger.range(new Badger("2026-06-01"), new Badger("bad"), "day")).toThrow(RangeError);
    });

    it("valid range still works after guards", () => {
        const result = Badger.range("2026-06-01", "2026-06-04", "day");
        expect(result).toHaveLength(3);
    });
});

// ─── add / subtract — NaN / Infinity amount ──────────────────────────────────
// Passing NaN or Infinity to setDate/setHours etc. silently produces an
// Invalid Date. The numeric path now throws RangeError before touching the date.

describe("add / subtract — NaN and Infinity amount guards", () => {
    const dt = new Badger("2026-06-15T12:00:00Z");

    it("add(NaN, 'day') throws RangeError", () => {
        expect(() => dt.add(NaN, "day")).toThrow(RangeError);
    });

    it("add(Infinity, 'hour') throws RangeError", () => {
        expect(() => dt.add(Infinity, "hour")).toThrow(RangeError);
    });

    it("add(-Infinity, 'month') throws RangeError", () => {
        expect(() => dt.add(-Infinity, "month")).toThrow(RangeError);
    });

    it("add({ days: NaN }) throws RangeError — NaN propagates through object path", () => {
        expect(() => dt.add({ days: NaN })).toThrow(RangeError);
    });

    it("add({ hours: Infinity }) throws RangeError", () => {
        expect(() => dt.add({ hours: Infinity })).toThrow(RangeError);
    });

    it("subtract(NaN, 'day') throws RangeError", () => {
        expect(() => dt.subtract(NaN, "day")).toThrow(RangeError);
    });

    it("subtract(Infinity, 'hour') throws RangeError", () => {
        expect(() => dt.subtract(Infinity, "hour")).toThrow(RangeError);
    });

    it("subtract({ days: NaN }) throws RangeError — NaN propagates through object path", () => {
        expect(() => dt.subtract({ days: NaN })).toThrow(RangeError);
    });

    it("add with valid finite amount still works", () => {
        expect(dt.add(1, "day").day).toBe(16);
    });

    it("subtract with valid finite amount still works", () => {
        expect(dt.subtract(1, "day").day).toBe(14);
    });
});

// ─── isSame — unknown unit default throw ─────────────────────────────────────

describe("isSame — unknown unit throws TypeError", () => {
    const dt = new Badger("2026-06-15T12:00:00Z");

    it("unknown unit throws TypeError", () => {
        expect(() => (dt as any).isSame(dt, "fortnight")).toThrow(TypeError);
    });

    it("known unit still works", () => {
        expect(dt.isSame(dt, "day")).toBe(true);
    });
});

// ─── diff — unknown unit default throw ───────────────────────────────────────

describe("diff — unknown unit throws TypeError", () => {
    const dt = new Badger("2026-06-15T12:00:00Z");

    it("unknown unit throws TypeError", () => {
        expect(() => (dt as any).diff(dt, "fortnight")).toThrow(TypeError);
    });

    it("known unit still works", () => {
        expect(dt.diff(dt, "day")).toBe(0);
    });
});

// ─── isWeekend / isWeekday / isBusinessDay — invalid Badger ──────────────────
// Previously returned wrong values (isWeekday returned true for invalid dates).

describe("isWeekend / isWeekday / isBusinessDay — invalid Badger", () => {
    const invalid = new Badger("not-a-date");

    it("isWeekend returns false for invalid date (not a random true)", () => {
        expect(invalid.isWeekend()).toBe(false);
    });

    it("isWeekday returns false for invalid date (was wrongly true before)", () => {
        expect(invalid.isWeekday()).toBe(false);
    });

    it("isBusinessDay returns false for invalid date", () => {
        expect(invalid.isBusinessDay()).toBe(false);
    });

    it("valid dates still work normally", () => {
        expect(new Badger("2026-06-20T00:00:00Z").isWeekend()).toBe(true);   // Saturday
        expect(new Badger("2026-06-15T00:00:00Z").isWeekday()).toBe(true);   // Monday
        expect(new Badger("2026-06-15T00:00:00Z").isBusinessDay()).toBe(true);
    });
});

// ─── countdown — invalid relativeTo ──────────────────────────────────────────
// Passing an invalid Date as relativeTo produced { days: NaN, ... } because
// NaN <= 0 is false. Now returns null immediately when relativeTo is invalid.

describe("countdown — invalid relativeTo guard", () => {
    const future = new Badger("2026-12-25T00:00:00Z");

    it("invalid relativeTo returns null", () => {
        expect(future.countdown(new Date("not-a-date"))).toBeNull();
    });

    it("valid relativeTo still works", () => {
        const result = future.countdown(new Date("2026-06-15T00:00:00Z"));
        expect(result).not.toBeNull();
        expect(result!.days).toBeGreaterThan(0);
    });
});

// ─── addBusinessDays / subtractBusinessDays — invalid Badger ─────────────────
// On an invalid Badger the loop body still ran n times before returning another
// invalid Badger. Now short-circuits immediately to clone().

describe("addBusinessDays / subtractBusinessDays — invalid Badger", () => {
    const invalid = new Badger("not-a-date");

    it("addBusinessDays on invalid Badger returns invalid clone without iterating", () => {
        const result = invalid.addBusinessDays(5);
        expect(result.isValid()).toBe(false);
    });

    it("subtractBusinessDays on invalid Badger returns invalid clone without iterating", () => {
        const result = invalid.subtractBusinessDays(5);
        expect(result.isValid()).toBe(false);
    });

    it("valid Badger still works normally", () => {
        const monday = new Badger("2026-06-15T12:00:00Z");
        expect(monday.addBusinessDays(1).toISOString()).toBe("2026-06-16T12:00:00.000Z");
    });
});

// ─── F1: toISOString — descriptive error on invalid date ──────────────────────
// Before fix: threw native `RangeError: Invalid time value` with no library context.
// After fix: throws `RangeError: Badger.toISOString(): date is not valid — ...`

describe("toISOString — invalid date guard (F1)", () => {
    it("invalid Badger throws RangeError (not the cryptic native error)", () => {
        const bad = new Badger("not-a-date");
        expect(() => bad.toISOString()).toThrow(RangeError);
    });

    it("error message names the method", () => {
        const bad = new Badger("not-a-date");
        expect(() => bad.toISOString()).toThrow(/toISOString/);
    });

    it("valid date still returns ISO string normally", () => {
        expect(new Badger("2026-06-15T10:30:00Z").toISOString()).toBe("2026-06-15T10:30:00.000Z");
    });
});

// ─── F2: isLeapYear — explicit guard on invalid date ─────────────────────────
// Before fix: returned `false` silently via NaN arithmetic — indistinguishable
// from a genuine non-leap year.
// After fix: returns `false` via an explicit `!this.isValid()` guard with JSDoc.

describe("isLeapYear — invalid date guard (F2)", () => {
    it("invalid date returns false (explicitly, not via silent NaN arithmetic)", () => {
        expect(new Badger("not-a-date").isLeapYear()).toBe(false);
    });

    it("valid non-leap year still returns false", () => {
        expect(new Badger("2026-01-01").isLeapYear()).toBe(false);
    });

    it("valid leap year still returns true", () => {
        expect(new Badger("2024-01-01").isLeapYear()).toBe(true);
    });
});

// ─── F3: fromLocal — out-of-range calendar values ────────────────────────────
// Before fix: "2026-13-45" matched the YYYY-MM-DD regex and overflowed to a
// wrong-but-valid date; "24:99" similarly overflowed.
// After fix: range checks + post-construction overflow check throw RangeError.

describe("fromLocal — out-of-range value validation (F3)", () => {
    it("month 00 throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-00-15", "10:00")).toThrow(RangeError);
    });

    it("month 13 throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-13-15", "10:00")).toThrow(RangeError);
    });

    it("day 00 throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-06-00", "10:00")).toThrow(RangeError);
    });

    it("day 32 throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-06-32", "10:00")).toThrow(RangeError);
    });

    it("hour 24 throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-06-15", "24:00")).toThrow(RangeError);
    });

    it("minute 60 throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-06-15", "10:60")).toThrow(RangeError);
    });

    it("Feb 31 overflows into March — post-construction check throws RangeError", () => {
        // Before fix: new Date(2026, 1, 31) overflows to 2026-03-03 silently.
        expect(() => Badger.fromLocal("2026-02-31", "10:00")).toThrow(RangeError);
    });

    it("Feb 29 on non-leap year overflows — post-construction check throws RangeError", () => {
        expect(() => Badger.fromLocal("2026-02-29", "10:00")).toThrow(RangeError);
    });

    it("Feb 29 on leap year is valid", () => {
        const dt = Badger.fromLocal("2024-02-29", "10:00");
        expect(dt.month).toBe(2);
        expect(dt.day).toBe(29);
    });

    it("valid date and time still works normally", () => {
        const dt = Badger.fromLocal("2026-06-15", "23:59");
        expect(dt.hour).toBe(23);
        expect(dt.minute).toBe(59);
        expect(dt.day).toBe(15);
        expect(dt.month).toBe(6);
    });
});

// ─── F4: Badger.min / Badger.max — invalid inputs ─────────────────────────────
// Before fix: result was position-dependent. `min(invalid, valid)` returned valid
// (invalid always loses) but `min(valid, invalid)` returned the invalid Badger.
// After fix: any invalid input throws RangeError immediately.

describe("Badger.min / Badger.max — invalid input guard (F4)", () => {
    const valid1 = new Badger("2026-01-01T00:00:00Z");
    const valid2 = new Badger("2026-12-31T00:00:00Z");
    const invalid = new Badger("not-a-date");

    it("min() with invalid as first arg throws RangeError", () => {
        // Before fix: invalid always loses, so this returned valid2 silently.
        expect(() => Badger.min(invalid, valid2)).toThrow(RangeError);
    });

    it("min() with invalid as last arg throws RangeError", () => {
        // Before fix: invalid in last position always wins, returning the invalid Badger.
        expect(() => Badger.min(valid1, invalid)).toThrow(RangeError);
    });

    it("min() with all valid still returns earliest", () => {
        expect(Badger.min(valid2, valid1).toISOString()).toBe(valid1.toISOString());
    });

    it("max() with invalid as first arg throws RangeError", () => {
        expect(() => Badger.max(invalid, valid2)).toThrow(RangeError);
    });

    it("max() with invalid as last arg throws RangeError", () => {
        expect(() => Badger.max(valid1, invalid)).toThrow(RangeError);
    });

    it("max() with all valid still returns latest", () => {
        expect(Badger.max(valid1, valid2).toISOString()).toBe(valid2.toISOString());
    });
});
