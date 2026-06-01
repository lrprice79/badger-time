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

    it("no arg → en-GB locale, Europe/London timezone", () => {
        const opts = Sett().resolvedOptions();
        expect(opts.locale).toBe("en-GB");
        expect(opts.timeZone).toBe("Europe/London");
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
