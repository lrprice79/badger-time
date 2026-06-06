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

// Export types only — the classes are not the public API
export type { Badger as BadgerInstance } from "./Badger";
export type { BadgerSett as BadgerSettInstance } from "./BadgerSett";

/** Creates a Badger date instance. Shorthand for `new Badger(date)`. */
export const Badger = (date?: string | Date): BadgerClass =>
    new BadgerClass(date);

/** Creates a BadgerSett formatter instance. Shorthand for `new BadgerSett(date, locale, options)`. */
export const Sett = (
    date?: Date | string,
    locale?: Intl.Locale,
    options?: Intl.DateTimeFormatOptions
): BadgerSettClass => new BadgerSettClass(date, locale, options);
