if (typeof process !== "undefined" && process.versions?.node) {
    const [major] = process.versions.node.split(".").map(Number);
    if (major < 20) {
        throw new Error(
            `badger-time requires Node.js 20 or higher. You are running Node.js ${process.versions.node}.`
        );
    }
}

import { Badger as BadgerClass } from "./Badger";
import { BadgerSett as BadgerSettClass } from "./BadgerSett";
import type { LocaleInput } from "./localeInfo";

export { BadgerSettings } from "./BadgerSettings";

// Export types only — the classes are not the public API.
// `BadgerInstance` / `BadgerSettInstance` are the long-standing instance-type
// names. The merged `Badger` / `Sett` type aliases below additionally let the
// SAME name serve as both a value (the factory) and a type (the instance) —
// e.g. `const d: Badger = Badger(...)` — with no separate type import.
export type { Badger as BadgerInstance } from "./Badger";
export type { BadgerSett as BadgerSettInstance } from "./BadgerSett";
export type { LocaleInput } from "./localeInfo";

/**
 * Creates a Badger date instance. Shorthand for `new Badger(date)`.
 *
 * The class statics (`fromLocal`, `range`, `min`, `max`) are attached to the
 * factory so the documented `Badger.fromLocal(...)` / `Badger.range(...)` calls
 * work on the public import — not just on the internal class.
 */
export const Badger = Object.assign(
    (date?: string | Date): BadgerClass => new BadgerClass(date),
    {
        fromLocal: BadgerClass.fromLocal.bind(BadgerClass),
        range: BadgerClass.range.bind(BadgerClass),
        min: BadgerClass.min.bind(BadgerClass),
        max: BadgerClass.max.bind(BadgerClass),
    },
);
/** The instance type returned by `Badger(...)` (value/type declaration merge). */
export type Badger = BadgerClass;

/** Creates a BadgerSett formatter instance. Shorthand for `new BadgerSett(date, locale, options)`. */
export const Sett = (
    date?: Date | string,
    locale?: LocaleInput,
    options?: Intl.DateTimeFormatOptions
): BadgerSettClass => new BadgerSettClass(date, locale, options);
/** The instance type returned by `Sett(...)` (value/type declaration merge). */
export type Sett = BadgerSettClass;
