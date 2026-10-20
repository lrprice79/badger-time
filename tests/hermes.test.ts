/**
 * Hermes (React Native's JS engine) has no `Intl.Locale`. Before this fix, every Sett created
 * without an explicit locale built `new Intl.Locale("en-GB")` and threw "undefined cannot be used
 * as a constructor"; formatTimeOnly / isWeekend / startOfWeek did the same. These tests delete
 * `Intl.Locale` to simulate Hermes, and pin that plain string locales work everywhere.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadgerSett } from "../src/BadgerSett";
import { BadgerSettings } from "../src/BadgerSettings";
import { Badger } from "../src/Badger";
import { firstDayOfWeek, localeTag, uses12HourClock, weekendDays } from "../src/localeInfo";

const intl = Intl as unknown as { Locale?: unknown };
const RealLocale = intl.Locale;

// 2026-03-14 is a Saturday, 2026-03-16 a Monday, 2026-03-18 a Wednesday.
const SAT = new Date("2026-03-14T12:00:00Z");
const WED = new Date("2026-03-18T12:00:00Z");

describe("on an engine without Intl.Locale (Hermes)", () => {
    beforeEach(() => { delete intl.Locale; });
    afterEach(() => { intl.Locale = RealLocale; BadgerSettings.reset(); });

    it("the simulation has teeth", () => {
        expect(intl.Locale).toBeUndefined();
        expect(() => new (Intl as any).Locale("en-GB")).toThrow();
    });

    it("Sett() with no locale constructs and formats (defaults to en-GB)", () => {
        const s = new BadgerSett(WED, undefined, { timeZone: "UTC" });
        expect(s.resolvedOptions().locale).toBe("en-GB");
        expect(s.formatDateOnly()).toBe("18/03/2026");
    });

    it("accepts a plain string locale", () => {
        expect(new BadgerSett(WED, "en-US", { timeZone: "UTC" }).formatDateOnly()).toBe("03/18/2026");
    });

    it("formatTimeOnly still picks 12h vs 24h from the locale", () => {
        expect(new BadgerSett(WED, "en-US", { timeZone: "UTC" }).formatTimeOnly()).toMatch(/PM/i);
        expect(new BadgerSett(WED, "en-GB", { timeZone: "UTC" }).formatTimeOnly()).toBe("12:00:00");
    });

    it("isWeekend / startOfWeek / getDaysOfTheWeek fall back to Sat+Sun and Monday-first", () => {
        expect(new BadgerSett(SAT, "en-GB").isWeekend()).toBe(true);
        expect(new BadgerSett(WED, "en-GB").isWeekend()).toBe(false);
        expect(new BadgerSett(WED, "en-GB").startOfWeek().getDay()).toBe(1); // Monday
        expect(new BadgerSett(WED, "en-GB").getDaysOfTheWeek()[0]).toBe("Monday");
    });

    it("business-day maths works with a string locale and with none", () => {
        expect(new Badger("2026-03-13").addBusinessDays(1, "en-GB").toISOString().slice(0, 10)).toBe("2026-03-16");
        expect(new Badger("2026-03-13").addBusinessDays(1).toISOString().slice(0, 10)).toBe("2026-03-16");
        expect(new Badger("2026-03-14").isBusinessDay("sv-SE")).toBe(false);
    });

    it("the helpers return the safe fallbacks", () => {
        expect(firstDayOfWeek("en-US")).toBe(1);
        expect(weekendDays("ar-SA")).toEqual([6, 7]);
        expect(localeTag(undefined)).toBe("en-GB");
    });
});

describe("plain string locales (with Intl.Locale available)", () => {
    afterEach(() => BadgerSettings.reset());

    it("Sett and the business-day methods accept a string exactly like an Intl.Locale", () => {
        expect(new BadgerSett(WED, "sv-SE", { timeZone: "UTC" }).formatDateOnly())
            .toBe(new BadgerSett(WED, new Intl.Locale("sv-SE"), { timeZone: "UTC" }).formatDateOnly());
        expect(new Badger("2026-03-14").isBusinessDay("en-GB")).toBe(new Badger("2026-03-14").isBusinessDay(new Intl.Locale("en-GB")));
    });

    it("locale-aware week info still flows through (en-US starts Sunday, where weekInfo exists)", () => {
        const loc = new Intl.Locale("en-US") as any;
        const info = loc.weekInfo ?? loc.getWeekInfo?.();
        const expected = info?.firstDay ?? 1;
        expect(firstDayOfWeek("en-US")).toBe(expected);
        expect(firstDayOfWeek(new Intl.Locale("en-US"))).toBe(expected);
    });

    it("localeTag normalises Intl.Locale, string and undefined (via the global default)", () => {
        expect(localeTag(new Intl.Locale("sv-SE"))).toBe("sv-SE");
        expect(localeTag("de-DE")).toBe("de-DE");
        BadgerSettings.setLocale(new Intl.Locale("en-US"));
        expect(localeTag(undefined)).toBe("en-US");
    });

    it("an unknown/garbage locale string falls back instead of throwing in the helpers", () => {
        expect(weekendDays("not a locale!!")).toEqual([6, 7]);
        expect(firstDayOfWeek("not a locale!!")).toBe(1);
    });
});

describe("uses12HourClock on an engine that reports hour12 but not hourCycle", () => {
    afterEach(() => vi.restoreAllMocks());

    it("falls back to hour12", () => {
        const real = Intl.DateTimeFormat.prototype.resolvedOptions;
        vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
            const { hourCycle: _drop, ...rest } = real.call(this) as any;
            return { ...rest, hour12: rest.locale.startsWith("en-US") };
        });
        expect(uses12HourClock("en-US")).toBe(true);
        expect(uses12HourClock("en-GB")).toBe(false);
    });
});

describe("week info across engine shapes", () => {
    it("reads the weekInfo property, the getWeekInfo() method, or falls back when neither exists", () => {
        const viaProp = { baseName: "x", weekInfo: { firstDay: 7, weekend: [5, 6] } } as unknown as Intl.Locale;
        const viaMethod = { baseName: "x", getWeekInfo: () => ({ firstDay: 6, weekend: [6, 7] }) } as unknown as Intl.Locale;
        const neither = { baseName: "x" } as unknown as Intl.Locale;
        expect([firstDayOfWeek(viaProp), weekendDays(viaProp)]).toEqual([7, [5, 6]]);
        expect(firstDayOfWeek(viaMethod)).toBe(6);
        expect([firstDayOfWeek(neither), weekendDays(neither)]).toEqual([1, [6, 7]]);
    });
});
