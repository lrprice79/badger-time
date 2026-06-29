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

export { BadgerSettings } from "./BadgerSettings";

// Export types only — the classes are not the public API.
// `BadgerInstance` / `BadgerSettInstance` are the long-standing instance-type
// names. The merged `Badger` / `Sett` type aliases below additionally let the
// SAME name serve as both a value (the factory) and a type (the instance) —
// e.g. `const d: Badger = Badger(...)` — with no separate type import.
export type { Badger as BadgerInstance } from "./Badger";
export type { BadgerSett as BadgerSettInstance } from "./BadgerSett";

/** Creates a Badger date instance. Shorthand for `new Badger(date)`. */
export const Badger = (date?: string | Date): BadgerClass =>
    new BadgerClass(date);
/** The instance type returned by `Badger(...)` (value/type declaration merge). */
export type Badger = BadgerClass;

/** Creates a BadgerSett formatter instance. Shorthand for `new BadgerSett(date, locale, options)`. */
export const Sett = (
    date?: Date | string,
    locale?: Intl.Locale,
    options?: Intl.DateTimeFormatOptions
): BadgerSettClass => new BadgerSettClass(date, locale, options);
/** The instance type returned by `Sett(...)` (value/type declaration merge). */
export type Sett = BadgerSettClass;
