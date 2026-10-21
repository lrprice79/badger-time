import { describe, it, expect } from "vitest";
import { Badger, Sett } from "../src/index";
import { Badger as BadgerClass } from "../src/Badger";
import { BadgerSett } from "../src/BadgerSett";

// ─── Badger() factory ─────────────────────────────────────────────────────────

describe("Badger() factory", () => {
    it("returns a Badger instance", () => {
        expect(Badger()).toBeInstanceOf(BadgerClass);
    });

    it("no arg → valid date close to now", () => {
        const before = Date.now();
        const dt = Badger();
        const after = Date.now();
        expect(dt.toDate().getTime()).toBeGreaterThanOrEqual(before);
        expect(dt.toDate().getTime()).toBeLessThanOrEqual(after);
    });

    it("accepts a date string", () => {
        expect(Badger("2026-06-15T12:00:00Z").toISOString()).toBe("2026-06-15T12:00:00.000Z");
    });

    it("accepts a Date object", () => {
        const d = new Date("2026-06-15T12:00:00Z");
        expect(Badger(d).toISOString()).toBe("2026-06-15T12:00:00.000Z");
    });

    it("returned instance supports chaining", () => {
        const result = Badger("2026-06-01T00:00:00Z").add(7, "day").toISOString();
        expect(result).toBe("2026-06-08T00:00:00.000Z");
    });
});

// ─── Sett() factory ───────────────────────────────────────────────────────────

describe("Sett() factory", () => {
    it("returns a BadgerSett instance", () => {
        expect(Sett()).toBeInstanceOf(BadgerSett);
    });

    it("no arg → en-GB locale, the device's timezone", () => {
        const opts = Sett().resolvedOptions();
        expect(opts.locale).toBe("en-GB");
        expect(opts.timeZone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
    });

    it("accepts a Date object", () => {
        const d = new Date("2026-06-15T12:00:00Z");
        expect(Sett(d).currentDate.getTime()).toBe(d.getTime());
    });

    it("accepts a locale", () => {
        const opts = Sett(new Date(), new Intl.Locale("sv-SE")).resolvedOptions();
        expect(opts.locale).toBe("sv-SE");
    });

    it("accepts custom Intl options", () => {
        const opts = Sett(new Date(), undefined, {
            timeZone: "America/New_York",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        }).resolvedOptions();
        expect(opts.timeZone).toBe("America/New_York");
    });

    it("returned instance supports formatting", () => {
        const result = Sett(new Date("2026-06-15T12:00:00Z")).formatForBackend();
        expect(result).toBe("2026-06-15T12:00:00.000Z");
    });

    it("Sett() and Badger() work together naturally", () => {
        const result = Sett(Badger("2026-06-15T00:00:00Z").toDate()).formatForBackend();
        expect(result).toBe("2026-06-15T00:00:00.000Z");
    });
});

// ─── class statics are reachable on the BARREL factory ────────────────────────
// Regression: `Badger.fromLocal/range/min/max` are documented on the public
// import. They live as statics on the class, so the factory must carry them —
// otherwise `Badger.fromLocal(...)` is undefined at runtime for consumers.

describe("Badger factory carries the class statics", () => {
    it("exposes fromLocal, range, min, max as functions", () => {
        expect(typeof Badger.fromLocal).toBe("function");
        expect(typeof Badger.range).toBe("function");
        expect(typeof Badger.min).toBe("function");
        expect(typeof Badger.max).toBe("function");
    });

    it("Badger.fromLocal returns a working instance", () => {
        const dt = Badger.fromLocal("2026-05-22", "00:15");
        expect(dt.hour).toBe(0);
        expect(dt.minute).toBe(15);
    });

    it("Badger.range returns the expected span", () => {
        const days = Badger.range("2026-03-01", "2026-03-05", "day");
        expect(days).toHaveLength(4);
        expect(days.every(d => d instanceof BadgerClass)).toBe(true);
    });

    it("Badger.min / Badger.max pick the right instance", () => {
        const a = Badger("2026-01-01T00:00:00Z");
        const b = Badger("2026-12-31T00:00:00Z");
        expect(Badger.min(a, b).toISOString()).toBe("2026-01-01T00:00:00.000Z");
        expect(Badger.max(a, b).toISOString()).toBe("2026-12-31T00:00:00.000Z");
    });
});
