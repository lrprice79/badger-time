# badger-time

> Lightweight date engine and formatter. Zero runtime dependencies. Immutable API. Native `Intl` throughout — no locale bundles, no bloat.

---

## Install

```bash
npm install badger-time
# or
yarn add badger-time
```

---

## Overview

badger-time exposes three named exports:

| Export | Purpose |
|---|---|
| `Badger(date?)` | Date arithmetic, comparison, and boundary operations |
| `Sett(date?, locale?, options?)` | Locale-aware formatting, calendar helpers, and duration display |
| `BadgerSettings` | Global locale and timezone defaults with reactive subscriber support |

No `new` required. All `Badger` methods return a **new instance** — the original is never mutated.

---

## Badger

### Construction

```ts
import { Badger } from "badger-time";

Badger()                           // current time
Badger("2026-03-15T10:30:00")     // bare datetime → treated as UTC (Z appended)
Badger("2026-03-15")              // date-only → UTC midnight
Badger("2026-03-15T10:30:00Z")    // explicit timezone → used as-is
Badger(someDate)                  // copy of a Date object
```

**String parsing rules**
- Date-only strings (`"YYYY-MM-DD"`) are parsed as UTC midnight — the ECMAScript spec handles this without needing a `Z` suffix (which Safari rejects).
- Strings with a timezone indicator (`Z` or `±HH:MM`) are used as-is.
- All other bare datetime strings get `"Z"` appended automatically.

### `Badger.fromLocal(date, time)` — local wall-clock factory

Use when a `"YYYY-MM-DD"` + `"HH:mm"` pair represents **local time** (e.g. a user-selected pickup slot). The standard factory would shift it by the UTC offset.

```ts
const dt = Badger.fromLocal("2026-05-22", "00:15");
dt.hour;      // 0  — local midnight, not shifted to UTC
dt.dayOfWeek; // 5  — Friday, correct local day
```

### `Badger.min(...dates)` / `Badger.max(...dates)`

```ts
const earliest = Badger.min(deadline, today, cutoff);
const latest   = Badger.max(deadline, today, cutoff);
```

---

### Getters

```ts
const dt = Badger("2026-07-04T15:30:45.123Z");

dt.year        // 2026
dt.month       // 7       (1-indexed — 1 = January)
dt.day         // 4
dt.hour        // 15
dt.minute      // 30
dt.second      // 45
dt.millisecond // 123
dt.dayOfWeek   // 6       (0 = Sunday … 6 = Saturday)
dt.dayOfYear   // 185     (1–365, or 1–366 in a leap year)
dt.weekYear    // 2026    (ISO week-year — may differ from .year at year boundaries)
dt.quarter     // 3       (1–4: Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec)
```

---

### Arithmetic

All methods return a new `Badger`. Negative amounts work on all units.

```ts
dt.add(7, "day")
dt.subtract(1, "month")
dt.add(-2, "hour")       // same as subtract(2, "hour")
```

Both `add` and `subtract` also accept a **duration object** to apply multiple units at once:

```ts
dt.add({ days: 7, hours: 2, minutes: 30 })
dt.subtract({ months: 1, days: 5 })
dt.add({ years: 1, months: 2 })
```

Singular and plural keys both work (`day`/`days`, `month`/`months`, etc.).

**Available units:** `"year"` `"quarter"` `"month"` `"week"` `"day"` `"hour"` `"minute"` `"second"` `"millisecond"`

> Month and year addition clamps to the last valid day when the target month is shorter than the source day — Jan 31 + 1 month → Feb 28/29, not Mar 3.

```ts
Badger("2026-01-31").add(1, "month").toISOString()
// "2026-02-28T00:00:00.000Z"
```

---

### Boundaries

```ts
dt.startOf("year")    // 1 Jan, 00:00:00.000
dt.startOf("quarter") // first day of the quarter, midnight
dt.startOf("month")   // first of the month, midnight
dt.startOf("week")    // Monday 00:00:00.000
dt.startOf("day")     // 00:00:00.000
dt.startOf("hour")    // zeros minutes, seconds, ms
dt.startOf("minute")  // zeros seconds and ms
dt.startOf("second")  // zeros milliseconds

dt.endOf("year")      // 31 Dec, 23:59:59.999
dt.endOf("quarter")   // last day of the quarter, 23:59:59.999
dt.endOf("month")     // last day, 23:59:59.999
dt.endOf("week")      // Sunday 23:59:59.999
dt.endOf("day")       // 23:59:59.999
dt.endOf("hour")      // sets minutes, seconds, ms to max
dt.endOf("minute")    // sets seconds to 59, ms to 999
dt.endOf("second")    // sets ms to 999
```

Weeks run **Monday → Sunday** (ISO 8601).

---

### Comparison

```ts
dt.isBefore(other)       // strictly before
dt.isAfter(other)        // strictly after
dt.isSameOrBefore(other) // before or equal
dt.isSameOrAfter(other)  // after or equal
```

**`isSame(other, unit?)`** — optionally compare at a given granularity:

```ts
const a = Badger("2026-06-15T10:30:00Z");
const b = Badger("2026-06-15T22:00:00Z");

a.isSame(b)         // false — different timestamps
a.isSame(b, "day")  // true  — same calendar day
a.isSame(b, "hour") // false — different hour
```

**`isBetween(start, end, options?)`** — both boundaries are **exclusive** by default. Throws `RangeError` if `start > end`.

```ts
const open  = Badger("2026-06-01T00:00:00Z");
const close = Badger("2026-06-30T00:00:00Z");
const date  = Badger("2026-06-15T00:00:00Z");

date.isBetween(open, close)                                           // true
open.isBetween(open, close)                                           // false — excluded
open.isBetween(open, close, { includeStart: true })                   // true
close.isBetween(open, close, { includeEnd: true })                    // true
open.isBetween(open, close, { includeStart: true, includeEnd: true }) // true
```

**Convenience helpers:**

```ts
dt.isToday()
dt.isYesterday()
dt.isTomorrow()
dt.isPast()      // strictly before now
dt.isFuture()    // strictly after now
dt.isWeekend()   // Saturday or Sunday
dt.isWeekday()   // Monday–Friday
```

**`isSameOrBefore` / `isSameOrAfter`** — optionally with unit granularity:

```ts
dt.isSameOrBefore(other)           // before or equal (exact)
dt.isSameOrBefore(other, "day")    // before or on the same calendar day
dt.isSameOrAfter(other)            // after or equal (exact)
dt.isSameOrAfter(other, "month")   // after or in the same month
```

**`clamp(min, max)`** — constrain to a range. Throws `RangeError` if `min > max`.

```ts
const min = Badger("2026-01-01T00:00:00Z");
const max = Badger("2026-12-31T00:00:00Z");

Badger("2025-06-15T00:00:00Z").clamp(min, max) // → min
Badger("2027-06-15T00:00:00Z").clamp(min, max) // → max
Badger("2026-06-15T00:00:00Z").clamp(min, max) // → unchanged
```

All comparisons accept `Badger | Date`.

---

### Diff

Returns a whole number by default. Pass `float: true` for a fractional result.

```ts
const a = Badger("2026-06-15T10:30:00Z");
const b = Badger("2026-06-15T09:00:00Z");

a.diff(b, "hour")        // 1    — floored
a.diff(b, "hour", true)  // 1.5  — fractional
b.diff(a, "minute")      // -90  — negative when b is before a
```

Month and year diffs are calendar-based (month components only — day-of-month is ignored). Jan 1 → Jan 31 = 0 months; Jan 31 → Feb 1 = 1 month.

`diff("day")`, `diff("week")`, and `dayOfYear` are **DST-safe** — they operate on local calendar dates projected into UTC, so the result is always an exact whole-day count regardless of whether the range spans a daylight saving transition.

---

### `set(unit, value)`

Returns a new `Badger` with a single field replaced. Month is 1-indexed. `"week"` and `"quarter"` are not supported.

```ts
dt.set("year",  2030)
dt.set("month", 1)     // January
dt.set("hour",  9)
dt.set("minute", 0)
```

Setting the month clamps the day when the target month is shorter (Jan 31 → set month to Feb → Feb 28).

Out-of-range values throw a `RangeError`: month must be 1–12, day 1–31, hour 0–23, minute/second 0–59, millisecond 0–999.

### Other utilities

```ts
dt.toISOString()             // "2026-03-15T10:30:00.000Z"
dt.toDate()                  // copy of the underlying Date object
dt.toUnixTimestamp()         // Unix seconds (floored)
dt.toMillisecondTimestamp()  // Unix milliseconds (exact)
dt.toObject()                // { year, month, day, hour, minute, second, millisecond }
dt.clone()                   // independent copy
dt.isValid()                 // false for invalid inputs
dt.getDaysInMonth()          // 28–31
dt.daysInYear()              // 365 or 366
dt.getWeekNumber()           // ISO 8601 week number (1–53)
dt.isLeapYear()
```

---

## BadgerSett

Locale-aware formatter built on `Intl.DateTimeFormat`. Defaults to `en-GB` / `Europe/London` unless overridden via `BadgerSettings`.

### Construction

```ts
import { Sett } from "badger-time";

Sett()                                             // now, global defaults or en-GB / London
Sett(someDate)
Sett(someDate, new Intl.Locale("sv-SE"))
Sett(someDate, new Intl.Locale("sv-SE"), {         // full control
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
})
```

### Display

```ts
const bs = Sett(new Date("2026-03-15T10:30:45Z"));

bs.formatDate()           // "15/03/2026, 10:30:45"
bs.formatDateOnly()       // "15/03/2026"
bs.formatTimeOnly()       // "10:30:45"
bs.getDayName()           // "Sunday"  (also: "short" | "narrow")
bs.getMonthName()         // "March"   (also: "short" | "narrow")
bs.getDaysOfTheWeek()     // ["Monday", …, "Sunday"]  — starts from locale's first day of week
bs.getMonthsOfTheYear()   // ["January", …, "December"]
```

### Locale-aware calendar

`isWeekend()` and `startOfWeek()` use the locale's `weekInfo` — no hardcoded Saturday/Sunday assumptions.

```ts
// Saudi Arabia: Friday and Saturday are the weekend
const bs = Sett(new Date(), new Intl.Locale("ar-SA"));
bs.isWeekend()    // true on Friday or Saturday, false on Sunday

// en-US weeks start on Sunday; en-GB weeks start on Monday
const us = Sett(new Date("2026-06-10T12:00:00Z"), new Intl.Locale("en-US"));
us.startOfWeek()  // Date → 2026-06-07T00:00:00.000Z  (Sunday)

const gb = Sett(new Date("2026-06-10T12:00:00Z"), new Intl.Locale("en-GB"));
gb.startOfWeek()  // Date → 2026-06-08T00:00:00.000Z  (Monday)
```

`startOfWeek()` returns a `Date` at UTC midnight of the first day of the week.

### Duration formatting

`formatDuration()` uses `Intl.DurationFormat` to produce a locale-aware human-readable duration string. No hand-rolled formatting — the platform does it.

> Requires `Intl.DurationFormat` (Node ≥ 24, Chrome 127+, Firefox 127+, Safari 17.4+). Throws in older environments.

```ts
const bs = Sett(new Date(), new Intl.Locale("en-GB"));

bs.formatDuration({ hours: 3, minutes: 22 })    // "3 hours and 22 minutes"
bs.formatDuration({ days: 1, hours: 4 })         // "1 day and 4 hours"
bs.formatDuration({ hours: 1 })                  // "1 hour"

const de = Sett(new Date(), new Intl.Locale("de-DE"));
de.formatDuration({ hours: 2, minutes: 30 })     // "2 Stunden und 30 Minuten"
```

Pair it with `diff()` to go straight from two dates to a display string:

```ts
const elapsed = Badger(startTime).diff(Badger(), "minute");
Sett(new Date(), new Intl.Locale("en-GB")).formatDuration({ minutes: elapsed });
// "47 minutes"
```

### Relative time

```ts
bs.formatRelative()             // "3 hours ago" / "in 2 days" — relative to now
bs.formatRelative(anchorDate)   // relative to a specific date instead
```

### Backend serialisation (UTC ISO)

```ts
bs.formatForBackend()              // "2026-03-15T10:30:45.000Z"
bs.formatForBackendToStartOfDay()  // midnight in the configured timezone → UTC ISO
bs.formatForBackendToEndOfDay()    // 23:59:59.999 in the configured timezone → UTC ISO
```

Start/end-of-day conversion is **DST-safe** — it resolves the correct UTC offset for that specific calendar date, including dates that fall on a DST boundary.

---

## BadgerSettings

Global defaults for locale and timezone. Set once at app startup — every `BadgerSett` instance created without an explicit locale will inherit these values automatically.

### Basic usage

```ts
import { BadgerSettings } from "badger-time";

// Set at app startup — all subsequent BadgerSett instances pick this up
BadgerSettings.defaultLocale   = new Intl.Locale("sv-SE");
BadgerSettings.defaultTimeZone = "Europe/Stockholm";

// No locale arg needed anywhere in the app
Sett(order.deliveryTime).formatDate();   // formatted in sv-SE / Stockholm
Sett(order.deliveryTime).isWeekend();    // uses sv-SE weekInfo
Sett(order.deliveryTime).startOfWeek();  // week starts per sv-SE
```

An explicit locale passed to the constructor always wins:

```ts
BadgerSettings.defaultLocale = new Intl.Locale("sv-SE");

Sett(date, new Intl.Locale("fr-FR")).formatDate();
// → fr-FR (explicit arg overrides the global)
```

### `setLocale()` + `subscribe()` — reactive language switching

`setLocale()` updates the global locale **and** notifies every active subscriber. This is the pattern for a language switcher — one call ripples out to every part of the UI that's subscribed.

`subscribe()` returns an unsubscribe function. Call it on cleanup to prevent memory leaks.

```ts
// Register a subscriber — fires whenever setLocale() is called
const unsub = BadgerSettings.subscribe(locale => {
    console.log("Locale changed to", locale.baseName);
});

BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
// → "Locale changed to fr-FR"

// Stop listening
unsub();
```

### React Native

Wire `BadgerSettings` into a context so every component re-renders automatically when the user switches language:

```tsx
// localeContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { BadgerSettings } from "badger-time";

const LocaleContext = createContext<Intl.Locale>(new Intl.Locale("en-GB"));

export function LocaleProvider({ children }) {
    const [locale, setLocale] = useState(
        BadgerSettings.defaultLocale ?? new Intl.Locale("en-GB")
    );

    useEffect(() => {
        // Returns the unsubscribe function — React calls it on unmount automatically
        return BadgerSettings.subscribe(setLocale);
    }, []);

    return (
        <LocaleContext.Provider value={locale}>
            {children}
        </LocaleContext.Provider>
    );
}

export const useLocale = () => useContext(LocaleContext);
```

```tsx
// SettingsScreen.tsx — language switcher
import { BadgerSettings } from "badger-time";

function LanguageSwitcher() {
    return (
        <Button
            title="Switch to French"
            onPress={() => BadgerSettings.setLocale(new Intl.Locale("fr-FR"))}
        />
    );
}
```

```tsx
// OrderCard.tsx — any component that displays dates
import { BadgerSett } from "badger-time";
import { useLocale } from "./localeContext";

function OrderCard({ order }) {
    const locale = useLocale(); // re-renders when locale changes

    const formatted = Sett(order.deliveryTime, locale).formatDate();
    const relative  = Sett(order.deliveryTime, locale).formatRelative();

    return (
        <View>
            <Text>{formatted}</Text>
            <Text>{relative}</Text>
        </View>
    );
}
```

One `BadgerSettings.setLocale()` call in the settings screen — every `OrderCard`, every date label in the app, updates automatically.

### React (web)

The same pattern works in a React web app:

```tsx
// App.tsx
import { useEffect } from "react";
import { BadgerSettings } from "badger-time";

export default function App() {
    useEffect(() => {
        // Initialise from the user's saved preference
        const saved = localStorage.getItem("locale");
        if (saved) BadgerSettings.setLocale(new Intl.Locale(saved));
    }, []);

    return <LocaleProvider><AppRoutes /></LocaleProvider>;
}
```

### Vue

```ts
// locale.ts
import { ref } from "vue";
import { BadgerSettings } from "badger-time";

export const appLocale = ref(new Intl.Locale("en-GB"));

BadgerSettings.subscribe(locale => {
    appLocale.value = locale;
});
```

```ts
// In any component
import { appLocale } from "./locale";
import { BadgerSett } from "badger-time";

const formatted = computed(() =>
    Sett(order.deliveryTime, appLocale.value).formatDate()
);
```

### Vanilla JS

```ts
BadgerSettings.subscribe(locale => {
    document.querySelectorAll<HTMLElement>("[data-timestamp]").forEach(el => {
        const ts = el.dataset.timestamp!;
        el.textContent = Sett(new Date(ts), locale).formatRelative();
    });
});
```

### `reset()`

Clears the global locale, timezone, and all subscribers. Useful in tests to prevent state leaking between cases.

```ts
BadgerSettings.reset();
```

---

## Common patterns

```ts
import { badger, sett, Badger, BadgerSettings } from "badger-time";

// Is a delivery slot today?
Badger(order.deliveryTime).isToday();

// Minutes until an order is due
Badger(order.dueAt).diff(Badger(), "minute");

// Progress through a shift (fractional hours)
Badger().diff(Badger(shiftStart), "hour", true);

// Is a booking within an open window (inclusive of opening time)?
slot.isBetween(openingTime, closingTime, { includeStart: true });

// Clamp a date to never exceed a deadline
const effective = Badger.min(selectedDate, deadline);

// Start of today in UTC for a backend query
Sett(Badger().toDate()).formatForBackendToStartOfDay();

// Localised opening hours label (Stockholm locale)
Sett(Badger(openingHour).toDate(), new Intl.Locale("sv-SE")).formatTimeOnly();

// Is today a day off? Respects locale-defined weekends (e.g. Fri+Sat in ar-SA)
Sett(new Date(), userLocale).isWeekend();

// Start of the current week for a locale-aware calendar view
Sett(new Date(), userLocale).startOfWeek();

// Human-readable elapsed time (Node 24+ / modern browsers)
const minutes = Badger(orderPlacedAt).diff(Badger(), "minute");
Sett(new Date(), new Intl.Locale("en-GB")).formatDuration({ minutes });
```

---

## Why badger-time?

| | moment | date-fns | luxon | badger-time |
|---|:---:|:---:|:---:|:---:|
| Zero runtime dependencies | ✗ | ✗ | ✅ | ✅ |
| Immutable API | ✗ | ✅ | ✅ | ✅ |
| Native `Intl` i18n (no locale bundles) | ✗ | ✗ | ✅ | ✅ |
| DST-safe start/end of day → UTC | ✗ | via date-fns-tz | ✅ | ✅ |
| Local wall-clock factory | ✗ | ✗ | ✅ | ✅ |
| Fractional diffs | ✅ | ✅ | ✅ | ✅ |
| Inclusive range bounds | ✅ | partial | ✗ | ✅ |
| Locale-aware weekend (`weekInfo`) | ✗ | ✗ | ✗ | ✅ |
| Locale-aware week start (`weekInfo`) | ✗ | ✗ | ✗ | ✅ |
| Native duration formatting (`Intl.DurationFormat`) | ✗ | ✗ | ✗ | ✅ |
| Reactive global locale (`subscribe`) | ✗ | ✗ | ✗ | ✅ |
| Bundle size (min+gzip) | ~72 KB | ~14 KB | ~23 KB | < 5 KB |

---

## License

UNLICENSED — private package.
