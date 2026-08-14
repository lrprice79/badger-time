/**
 * Los Angeles timezone tests for Badger (TZ=America/Los_Angeles).
 *
 * LA is WEST of UTC (UTC-8 PST / UTC-7 PDT), so this suite guards the
 * date-only-string parsing path specifically. A date-only string like
 * "2026-01-31" must anchor to LOCAL midnight — if it were parsed as UTC
 * midnight (the historical behaviour), its *local* calendar day would read
 * as the previous day (Jan 30) west of UTC, silently drifting `.day`,
 * `add("month")`, and `Badger.range(…, "month")`.
 *
 * Every test here is written to FAIL under the old UTC-midnight parse and
 * pass under local-midnight anchoring. Unlike the NY suite (which routes
 * everything through Badger.fromLocal and therefore never exercises this
 * path), these use the bare `new Badger("YYYY-MM-DD")` string constructor.
 *
 * 2026 DST transitions in America/Los_Angeles:
 *   Spring forward — March 8 at 02:00 PST → 03:00 PDT
 *   Fall back      — November 1 at 02:00 PDT → 01:00 PST
 */

import { describe, it, expect } from "vitest";
import { Badger } from "../src/Badger";

// ─── date-only string anchors to LOCAL midnight ──────────────────────────────

describe("date-only string parsing — Los Angeles (west of UTC)", () => {
    it("Badger('2026-01-31') reads local calendar day 31, not 30", () => {
        const dt = new Badger("2026-01-31");
        expect(dt.year).toBe(2026);
        expect(dt.month).toBe(1);
        expect(dt.day).toBe(31);
        expect(dt.hour).toBe(0);
        expect(dt.minute).toBe(0);
    });

    it("dayOfWeek is correct — Jan 31 2026 is a Saturday (6)", () => {
        expect(new Badger("2026-01-31").dayOfWeek).toBe(6);
    });

    it("dayOfYear is correct for a date-only string", () => {
        // Jan(31) → day 31
        expect(new Badger("2026-01-31").dayOfYear).toBe(31);
    });

    it("date-only on the spring-forward day reads day 8", () => {
        const dt = new Badger("2026-03-08");
        expect(dt.month).toBe(3);
        expect(dt.day).toBe(8);
        expect(dt.hour).toBe(0);
    });

    it("date-only on the fall-back day reads day 1", () => {
        const dt = new Badger("2026-11-01");
        expect(dt.month).toBe(11);
        expect(dt.day).toBe(1);
        expect(dt.hour).toBe(0);
    });

    it("last day of the year reads Dec 31", () => {
        const dt = new Badger("2026-12-31");
        expect(dt.month).toBe(12);
        expect(dt.day).toBe(31);
    });
});

// ─── month arithmetic on a date-only string does not drift ───────────────────

describe("add/subtract months on date-only string — Los Angeles", () => {
    it("Jan 31 + 1 month clamps to Feb 28 (local), not Feb 27", () => {
        const dt = new Badger("2026-01-31").add(1, "month");
        expect(dt.month).toBe(2);
        expect(dt.day).toBe(28);
    });

    it("Jan 31 + 2 months re-anchors to Mar 31 (local), not Mar 30", () => {
        const dt = new Badger("2026-01-31").add(2, "month");
        expect(dt.month).toBe(3);
        expect(dt.day).toBe(31);
    });

    it("Mar 31 - 1 month clamps to Feb 28 (local)", () => {
        const dt = new Badger("2026-03-31").subtract(1, "month");
        expect(dt.month).toBe(2);
        expect(dt.day).toBe(28);
    });
});

// ─── Badger.range("month") on date-only strings — the README example ─────────

describe("Badger.range month — Los Angeles (README example)", () => {
    it("monthly range from Jan 31 yields local days 31,28,31,30,31 — no drift", () => {
        const result = Badger.range("2026-01-31", "2026-06-01", "month");
        expect(result.map(d => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`))
            .toEqual([
                "2026-01-31",
                "2026-02-28",
                "2026-03-31",
                "2026-04-30",
                "2026-05-31",
            ]);
    });

    it("monthly range of a full year keeps the anchor day-of-month", () => {
        const result = Badger.range("2026-01-15", "2027-01-01", "month");
        expect(result).toHaveLength(12);
        expect(result.every(d => d.day === 15)).toBe(true);
        expect(result.map(d => d.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
});

// ─── Badger.range("day") on date-only strings across DST ─────────────────────

describe("Badger.range day — Los Angeles date-only across DST", () => {
    it("daily range across spring-forward keeps correct local dates", () => {
        const result = Badger.range("2026-03-07", "2026-03-11", "day");
        expect(result).toHaveLength(4);
        expect(result.map(d => d.day)).toEqual([7, 8, 9, 10]);
        expect(result.map(d => d.month)).toEqual([3, 3, 3, 3]);
    });

    it("daily range across fall-back keeps correct local dates", () => {
        const result = Badger.range("2026-10-30", "2026-11-03", "day");
        expect(result.map(d => `${d.month}/${d.day}`)).toEqual(["10/30", "10/31", "11/1", "11/2"]);
    });

    it("every day in June from date-only strings is 30 entries, June 1–30", () => {
        const result = Badger.range("2026-06-01", "2026-07-01", "day");
        expect(result).toHaveLength(30);
        expect(result[0].day).toBe(1);
        expect(result[result.length - 1].day).toBe(30);
        expect(result.every(d => d.month === 6)).toBe(true);
    });
});

// ─── boundaries & comparisons on date-only strings ───────────────────────────

describe("boundaries / comparisons on date-only string — Los Angeles", () => {
    it("startOf('month') on a date-only string stays in the same local month", () => {
        const dt = new Badger("2026-01-31").startOf("month");
        expect(dt.month).toBe(1);
        expect(dt.day).toBe(1);
        expect(dt.hour).toBe(0);
    });

    it("endOf('month') on a date-only string lands on the local last day", () => {
        const dt = new Badger("2026-02-15").endOf("month");
        expect(dt.month).toBe(2);
        expect(dt.day).toBe(28);
    });

    it("two date-only strings for the same day are isSame('day')", () => {
        expect(new Badger("2026-01-31").isSame(new Badger("2026-01-31"), "day")).toBe(true);
    });

    it("consecutive date-only strings are not isSame('day')", () => {
        expect(new Badger("2026-01-31").isSame(new Badger("2026-02-01"), "day")).toBe(false);
    });

    it("getDaysInMonth is correct from a date-only string", () => {
        expect(new Badger("2026-02-10").getDaysInMonth()).toBe(28);
    });

    it("isBusinessDay on a date-only Saturday is false", () => {
        // Jan 31 2026 is a Saturday
        expect(new Badger("2026-01-31").isBusinessDay()).toBe(false);
    });
});

// ─── toLocalISODate — the safe replacement for toISOString().slice(0,10) ──────

describe("toLocalISODate — Los Angeles (west of UTC)", () => {
    it("round-trips a date-only string (never the previous/next day)", () => {
        expect(new Badger("2026-02-01").toLocalISODate()).toBe("2026-02-01");
        expect(new Badger("2026-12-25").toLocalISODate()).toBe("2026-12-25");
    });

    it("is correct after day arithmetic (the isoAdd pattern)", () => {
        expect(new Badger("2026-02-01").add(1, "day").toLocalISODate()).toBe("2026-02-02");
        expect(new Badger("2026-06-15").add(7, "day").toLocalISODate()).toBe("2026-06-22");
        expect(new Badger("2026-01-31").subtract(1, "day").toLocalISODate()).toBe("2026-01-30");
    });

    it("is correct across the spring-forward day", () => {
        expect(new Badger("2026-03-07").add(1, "day").toLocalISODate()).toBe("2026-03-08");
        expect(new Badger("2026-03-08").add(1, "day").toLocalISODate()).toBe("2026-03-09");
    });
});
