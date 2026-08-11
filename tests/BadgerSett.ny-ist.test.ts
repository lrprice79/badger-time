/**
 * BadgerSett — America/New_York and Asia/Kolkata coverage.
 *
 * Tests run under TZ=UTC (the default test env) — explicit timeZone options are
 * what drive the results, so the process TZ is irrelevant here.
 *
 * America/New_York 2026:
 *   Spring forward — March 8 at 02:00 EST → 03:00 EDT  (clocks +1h, 23-hour day)
 *   Fall back      — November 1 at 02:00 EDT → 01:00 EST (clocks -1h, 25-hour day)
 *
 * Asia/Kolkata (IST):
 *   UTC+5:30 all year, no DST — half-hour offset makes every midnight 18:30 UTC
 *   the previous day.
 */

import { describe, it, expect } from "vitest";
import { BadgerSett } from "../src/BadgerSett";

// ─── helpers ─────────────────────────────────────────────────────────────────

function nyOpts(): Intl.DateTimeFormatOptions {
    return {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false, timeZone: "America/New_York"
    };
}

function istOpts(): Intl.DateTimeFormatOptions {
    return {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false, timeZone: "Asia/Kolkata"
    };
}

const NY = new Intl.Locale("en-US");
const IN = new Intl.Locale("en-IN");

// ─── America/New_York — mid-month (15th) all 12 months ───────────────────────
// Jan–Feb: EST (UTC-5)  → midnight = T05:00Z,  end = T04:59:59.999Z next day
// Mar–Oct: EDT (UTC-4)  → midnight = T04:00Z,  end = T03:59:59.999Z next day
//   (spring forward Mar 8; Mar 15 is already in EDT)
// Nov–Dec: EST (UTC-5)  → midnight = T05:00Z,  end = T04:59:59.999Z next day
//   (fall back Nov 1; Nov 15 is already in EST)

describe("BadgerSett — New York mid-month start/end of day", () => {
    const cases: [string, string, string][] = [
        ["Jan", "2026-01-15T12:00:00Z", "2026-01-15T05:00:00.000Z"],
        ["Feb", "2026-02-15T12:00:00Z", "2026-02-15T05:00:00.000Z"],
        ["Mar", "2026-03-15T12:00:00Z", "2026-03-15T04:00:00.000Z"], // EDT
        ["Apr", "2026-04-15T12:00:00Z", "2026-04-15T04:00:00.000Z"],
        ["May", "2026-05-15T12:00:00Z", "2026-05-15T04:00:00.000Z"],
        ["Jun", "2026-06-15T12:00:00Z", "2026-06-15T04:00:00.000Z"],
        ["Jul", "2026-07-15T12:00:00Z", "2026-07-15T04:00:00.000Z"],
        ["Aug", "2026-08-15T12:00:00Z", "2026-08-15T04:00:00.000Z"],
        ["Sep", "2026-09-15T12:00:00Z", "2026-09-15T04:00:00.000Z"],
        ["Oct", "2026-10-15T12:00:00Z", "2026-10-15T04:00:00.000Z"],
        ["Nov", "2026-11-15T12:00:00Z", "2026-11-15T05:00:00.000Z"], // EST
        ["Dec", "2026-12-15T12:00:00Z", "2026-12-15T05:00:00.000Z"],
    ];

    for (const [label, input, expectedStart] of cases) {
        const expectedEnd = expectedStart.replace("T05:00:00.000Z", "T04:59:59.999Z")
                                         .replace("T04:00:00.000Z", "T03:59:59.999Z")
                                         .replace(/^(2026-\d{2}-15)/, (_, d) => {
                                             const next = new Date(d + "T00:00:00Z");
                                             next.setUTCDate(next.getUTCDate() + 1);
                                             return next.toISOString().slice(0, 10);
                                         });
        it(`${label} — start of day`, () => {
            const bs = new BadgerSett(new Date(input), NY, nyOpts());
            expect(bs.formatForBackendToStartOfDay()).toBe(expectedStart);
        });
    }

    // End-of-day spot checks (representative months)
    it("Jan — end of day = Jan 16T04:59:59.999Z", () => {
        expect(new BadgerSett(new Date("2026-01-15T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-01-16T04:59:59.999Z");
    });

    it("Jun — end of day = Jun 16T03:59:59.999Z (EDT)", () => {
        expect(new BadgerSett(new Date("2026-06-15T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-06-16T03:59:59.999Z");
    });

    it("Dec — end of day = Dec 16T04:59:59.999Z", () => {
        expect(new BadgerSett(new Date("2026-12-15T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-12-16T04:59:59.999Z");
    });
});

// ─── America/New_York — DST boundary days ────────────────────────────────────
// Spring forward March 8: clocks skip 2→3 AM, so midnight Mar 8 is still EST.
// endOf Mar 8 is 23:59:59 EDT (UTC-4) = 03:59:59Z Mar 9.
//
// Fall back November 1: clocks repeat 2→1 AM, so midnight Nov 1 is EDT (UTC-4).
// endOf Nov 1 is 23:59:59 EST (UTC-5) = 04:59:59Z Nov 2.

describe("BadgerSett — New York DST boundary days", () => {
    it("Mar 7 (last EST day) — start", () => {
        expect(new BadgerSett(new Date("2026-03-07T12:00:00Z"), NY, nyOpts()).formatForBackendToStartOfDay())
            .toBe("2026-03-07T05:00:00.000Z");
    });

    it("Mar 7 (last EST day) — end", () => {
        expect(new BadgerSett(new Date("2026-03-07T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-03-08T04:59:59.999Z");
    });

    it("Mar 8 (spring-forward day, midnight is still EST) — start", () => {
        expect(new BadgerSett(new Date("2026-03-08T12:00:00Z"), NY, nyOpts()).formatForBackendToStartOfDay())
            .toBe("2026-03-08T05:00:00.000Z");
    });

    it("Mar 8 (spring-forward day) — end is EDT (23:59:59 EDT = 03:59:59Z Mar 9)", () => {
        expect(new BadgerSett(new Date("2026-03-08T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-03-09T03:59:59.999Z");
    });

    it("Mar 9 (first EDT day) — start", () => {
        expect(new BadgerSett(new Date("2026-03-09T12:00:00Z"), NY, nyOpts()).formatForBackendToStartOfDay())
            .toBe("2026-03-09T04:00:00.000Z");
    });

    it("Mar 9 (first EDT day) — end", () => {
        expect(new BadgerSett(new Date("2026-03-09T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-03-10T03:59:59.999Z");
    });

    it("Nov 1 (fall-back day, midnight is EDT) — start", () => {
        expect(new BadgerSett(new Date("2026-11-01T12:00:00Z"), NY, nyOpts()).formatForBackendToStartOfDay())
            .toBe("2026-11-01T04:00:00.000Z");
    });

    it("Nov 1 (fall-back day) — end is EST (23:59:59 EST = 04:59:59Z Nov 2)", () => {
        expect(new BadgerSett(new Date("2026-11-01T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-11-02T04:59:59.999Z");
    });

    it("Nov 2 (first full EST day) — start", () => {
        expect(new BadgerSett(new Date("2026-11-02T12:00:00Z"), NY, nyOpts()).formatForBackendToStartOfDay())
            .toBe("2026-11-02T05:00:00.000Z");
    });

    it("Nov 2 (first full EST day) — end", () => {
        expect(new BadgerSett(new Date("2026-11-02T12:00:00Z"), NY, nyOpts()).formatForBackendToEndOfDay())
            .toBe("2026-11-03T04:59:59.999Z");
    });
});

// ─── America/New_York — end of each month ────────────────────────────────────

describe("BadgerSett — New York end-of-month start/end of day", () => {
    const cases: [string, string, string, string][] = [
        ["Jan 31", "2026-01-31T12:00:00Z", "2026-01-31T05:00:00.000Z", "2026-02-01T04:59:59.999Z"],
        ["Feb 28", "2026-02-28T12:00:00Z", "2026-02-28T05:00:00.000Z", "2026-03-01T04:59:59.999Z"],
        ["Mar 31", "2026-03-31T12:00:00Z", "2026-03-31T04:00:00.000Z", "2026-04-01T03:59:59.999Z"],
        ["Apr 30", "2026-04-30T12:00:00Z", "2026-04-30T04:00:00.000Z", "2026-05-01T03:59:59.999Z"],
        ["May 31", "2026-05-31T12:00:00Z", "2026-05-31T04:00:00.000Z", "2026-06-01T03:59:59.999Z"],
        ["Jun 30", "2026-06-30T12:00:00Z", "2026-06-30T04:00:00.000Z", "2026-07-01T03:59:59.999Z"],
        ["Jul 31", "2026-07-31T12:00:00Z", "2026-07-31T04:00:00.000Z", "2026-08-01T03:59:59.999Z"],
        ["Aug 31", "2026-08-31T12:00:00Z", "2026-08-31T04:00:00.000Z", "2026-09-01T03:59:59.999Z"],
        ["Sep 30", "2026-09-30T12:00:00Z", "2026-09-30T04:00:00.000Z", "2026-10-01T03:59:59.999Z"],
        ["Oct 31", "2026-10-31T12:00:00Z", "2026-10-31T04:00:00.000Z", "2026-11-01T03:59:59.999Z"],
        ["Nov 30", "2026-11-30T12:00:00Z", "2026-11-30T05:00:00.000Z", "2026-12-01T04:59:59.999Z"],
        ["Dec 31", "2026-12-31T12:00:00Z", "2026-12-31T05:00:00.000Z", "2027-01-01T04:59:59.999Z"],
    ];

    for (const [label, input, expectedStart, expectedEnd] of cases) {
        it(`${label} — start`, () => {
            expect(new BadgerSett(new Date(input), NY, nyOpts()).formatForBackendToStartOfDay())
                .toBe(expectedStart);
        });
        it(`${label} — end`, () => {
            expect(new BadgerSett(new Date(input), NY, nyOpts()).formatForBackendToEndOfDay())
                .toBe(expectedEnd);
        });
    }
});

// ─── Asia/Kolkata — mid-month (15th) all 12 months ───────────────────────────
// UTC+5:30 year-round — midnight IST = 18:30 UTC the previous day.
// startOfDay for date D = (D-1)T18:30:00.000Z
// endOfDay   for date D = DT18:29:59.999Z

describe("BadgerSett — Kolkata (UTC+5:30) mid-month start/end of day", () => {
    const months = [
        ["Jan", "01"], ["Feb", "02"], ["Mar", "03"], ["Apr", "04"],
        ["May", "05"], ["Jun", "06"], ["Jul", "07"], ["Aug", "08"],
        ["Sep", "09"], ["Oct", "10"], ["Nov", "11"], ["Dec", "12"],
    ] as const;

    for (const [label, m] of months) {
        it(`${label} — start of day (18:30 UTC prev day)`, () => {
            const bs = new BadgerSett(new Date(`2026-${m}-15T12:00:00Z`), IN, istOpts());
            expect(bs.formatForBackendToStartOfDay()).toBe(`2026-${m}-14T18:30:00.000Z`);
        });

        it(`${label} — end of day (18:29:59.999 UTC same day)`, () => {
            const bs = new BadgerSett(new Date(`2026-${m}-15T12:00:00Z`), IN, istOpts());
            expect(bs.formatForBackendToEndOfDay()).toBe(`2026-${m}-15T18:29:59.999Z`);
        });
    }
});

// ─── Asia/Kolkata — end of each month ────────────────────────────────────────
// Month-end tests confirm no off-by-one when the local date is the last day of a
// month but the UTC end-of-day spills into the first day of the next month.

describe("BadgerSett — Kolkata end-of-month start/end of day", () => {
    const cases: [string, string, string, string][] = [
        ["Jan 31", "2026-01-31T12:00:00Z", "2026-01-30T18:30:00.000Z", "2026-01-31T18:29:59.999Z"],
        ["Feb 28", "2026-02-28T12:00:00Z", "2026-02-27T18:30:00.000Z", "2026-02-28T18:29:59.999Z"],
        ["Mar 31", "2026-03-31T12:00:00Z", "2026-03-30T18:30:00.000Z", "2026-03-31T18:29:59.999Z"],
        ["Apr 30", "2026-04-30T12:00:00Z", "2026-04-29T18:30:00.000Z", "2026-04-30T18:29:59.999Z"],
        ["May 31", "2026-05-31T12:00:00Z", "2026-05-30T18:30:00.000Z", "2026-05-31T18:29:59.999Z"],
        ["Jun 30", "2026-06-30T12:00:00Z", "2026-06-29T18:30:00.000Z", "2026-06-30T18:29:59.999Z"],
        ["Jul 31", "2026-07-31T12:00:00Z", "2026-07-30T18:30:00.000Z", "2026-07-31T18:29:59.999Z"],
        ["Aug 31", "2026-08-31T12:00:00Z", "2026-08-30T18:30:00.000Z", "2026-08-31T18:29:59.999Z"],
        ["Sep 30", "2026-09-30T12:00:00Z", "2026-09-29T18:30:00.000Z", "2026-09-30T18:29:59.999Z"],
        ["Oct 31", "2026-10-31T12:00:00Z", "2026-10-30T18:30:00.000Z", "2026-10-31T18:29:59.999Z"],
        ["Nov 30", "2026-11-30T12:00:00Z", "2026-11-29T18:30:00.000Z", "2026-11-30T18:29:59.999Z"],
        ["Dec 31", "2026-12-31T12:00:00Z", "2026-12-30T18:30:00.000Z", "2026-12-31T18:29:59.999Z"],
    ];

    for (const [label, input, expectedStart, expectedEnd] of cases) {
        it(`${label} — start`, () => {
            expect(new BadgerSett(new Date(input), IN, istOpts()).formatForBackendToStartOfDay())
                .toBe(expectedStart);
        });
        it(`${label} — end`, () => {
            expect(new BadgerSett(new Date(input), IN, istOpts()).formatForBackendToEndOfDay())
                .toBe(expectedEnd);
        });
    }
});

// ─── Southern-hemisphere DST: start/end of day (regression) ───────────────────
// Regression for the day-boundary serialization. The old offset-guessing
// algorithm returned the WRONG instant for large-offset zones on their
// fall-back day — Sydney/Melbourne gave 01:00 instead of 00:00, and
// Auckland/Chatham landed on the wrong DAY. The boundary is now found by binary
// search on the local date, which is DST-proof. These assert the definitive
// spec via a ±1ms nudge (no hard-coded UTC instants):
//   start-of-day = first ms of the local date, end-of-day = last ms.
describe("BadgerSett — southern-hemisphere DST day boundaries", () => {
    const dateKey = (iso: string, tz: string) => {
        const p = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).formatToParts(new Date(iso));
        const g = (t: string) => p.find(x => x.type === t)!.value;
        return `${g("year")}-${g("month")}-${g("day")}`;
    };
    // 2026: AU/NZ fall back on Apr 5, spring forward on Oct 4.
    const cases = [
        { tz: "Australia/Sydney",    d: "2026-04-05" },
        { tz: "Australia/Melbourne", d: "2026-04-05" },
        { tz: "Australia/Adelaide",  d: "2026-04-05" }, // +10:30/+9:30 half-hour
        { tz: "Australia/Lord_Howe", d: "2026-04-05" }, // 30-minute DST amount
        { tz: "Pacific/Auckland",    d: "2026-04-05" },
        { tz: "Pacific/Chatham",     d: "2026-04-05" }, // +12:45/+13:45
        { tz: "Australia/Sydney",    d: "2026-10-04" }, // spring forward
        { tz: "Pacific/Auckland",    d: "2026-10-04" },
    ];
    for (const { tz, d } of cases) {
        it(`${tz} @ ${d} — start-of-day is the first ms of the local date`, () => {
            // Use local noon so the tz-local date is unambiguously `d`.
            const bs = new BadgerSett(new Date(`${d}T12:00:00Z`), undefined, { timeZone: tz });
            // Guard: noon-UTC may fall on the next local day for far-east zones —
            // anchor on whatever local date the instance actually reports.
            const target = dateKey(`${d}T12:00:00Z`, tz);
            const start = bs.formatForBackendToStartOfDay();
            expect(dateKey(start, tz)).toBe(target);
            expect(dateKey(new Date(new Date(start).getTime() - 1).toISOString(), tz) < target).toBe(true);
        });
        it(`${tz} @ ${d} — end-of-day is the last ms of the local date`, () => {
            const bs = new BadgerSett(new Date(`${d}T12:00:00Z`), undefined, { timeZone: tz });
            const target = dateKey(`${d}T12:00:00Z`, tz);
            const end = bs.formatForBackendToEndOfDay();
            expect(dateKey(end, tz)).toBe(target);
            expect(dateKey(new Date(new Date(end).getTime() + 1).toISOString(), tz) > target).toBe(true);
            expect(new Date(end).getUTCMilliseconds()).toBe(999);
        });
    }
});
