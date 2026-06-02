# badger-time

> The date library that actually understands where your users live.

Zero runtime dependencies. Immutable API. Fully typed. Native `Intl` throughout — no locale bundles, no bloat, no compromises.

---

## Install

```bash
npm install badger-time
# or
yarn add badger-time
```

---

## Why badger-time?

Every major date library makes the same mistake: they treat the world as if everyone works Monday to Friday, weeks start on Monday, and times are always displayed in 24-hour format. They're wrong.

badger-time uses the browser and Node's built-in `Intl` APIs to get these things right automatically — locale-aware weekends, locale-aware week starts, locale-aware time formatting — with zero extra bundle weight.

| | moment | date-fns | luxon | badger-time |
|---|:---:|:---:|:---:|:---:|
| Zero runtime dependencies | ✗ | ✗ | ✅ | ✅ |
| Immutable API | ✗ | ✅ | ✅ | ✅ |
| No `new` keyword required | ✗ | ✅ | ✗ | ✅ |
| Native `Intl` i18n — no locale bundles | ✗ | ✗ | ✅ | ✅ |
| DST-safe day/week diffs | ✗ | ✗ | ✅ | ✅ |
| DST-safe start/end of day → UTC | ✗ | via date-fns-tz | ✅ | ✅ |
| Local wall-clock factory | ✗ | ✗ | ✅ | ✅ |
| Fractional diffs | ✅ | ✅ | ✅ | ✅ |
| Inclusive range bounds | ✅ | partial | ✗ | ✅ |
| Locale-aware weekend (`weekInfo`) | ✗ | ✗ | ✗ | ✅ |
| Locale-aware week start (`weekInfo`) | ✗ | ✗ | ✗ | ✅ |
| Locale-aware hour cycle (12h/24h) | ✗ | ✗ | ✗ | ✅ |
| Locale-aware business days | ✗ | ✗ | ✗ | ✅ |
| Date range iterator | ✗ | ✗ | ✗ | ✅ |
| Countdown with `null` for past dates | ✗ | ✗ | ✗ | ✅ |
| Native duration formatting (`Intl.DurationFormat`) | ✗ | ✗ | ✗ | ✅ |
| Reactive global locale (`subscribe`) | ✗ | ✗ | ✗ | ✅ |
| Bundle size (min+gzip) | ~72 KB | ~14 KB | ~23 KB | **~7 KB** |

---

## Quick start

```ts
import { Badger, Sett, BadgerSettings } from "badger-time";

// Set your app's locale once at startup
BadgerSettings.setLocale(new Intl.Locale("en-US"));
BadgerSettings.defaultTimeZone = "America/New_York";

// Date arithmetic — no new keyword
Badger("2026-06-15").add(7, "day").toISOString()
// "2026-06-22T00:00:00.000Z"

// Is a delivery slot today?
Badger(order.deliveryTime).isToday()

// Format for display — picks up the global locale automatically
Sett(order.deliveryTime).formatDate()        // "06/15/2026, 03:30:45 PM"
Sett(order.deliveryTime).formatRelative()    // "in 2 hours"
Sett(order.deliveryTime).formatTimeOnly()    // "03:30:45 PM"  ← 12h for en-US, auto-detected

// Countdown timer
Sett(new Date()).formatCountdown(Badger("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"  — or null if past
```

---

## API

### Exports

| Export | Kind | Purpose |
|---|---|---|
| `Badger(date?)` | factory | Date arithmetic, comparison, boundaries, business days, ranges |
| `Sett(date?, locale?, options?)` | factory | Locale-aware formatting, calendar helpers, countdown |
| `BadgerSettings` | class | Global locale/timezone defaults + reactive subscriber |
| `BadgerInstance` | type | TypeScript type for values returned by `Badger()` |
| `BadgerSettInstance` | type | TypeScript type for values returned by `Sett()` |

No `new` required anywhere. All `Badger` methods return a new instance — the original is never mutated.

### TypeScript

```ts
import { Badger, Sett } from "badger-time";
import type { BadgerInstance, BadgerSettInstance } from "badger-time";

function addBusinessDays(date: BadgerInstance, n: number): BadgerInstance {
    return date.addBusinessDays(n);
}

function formatForDisplay(date: BadgerInstance): BadgerSettInstance {
    return Sett(date.toDate());
}
```

---

## Badger — date arithmetic

### Construction

```ts
Badger()                           // current time
Badger("2026-03-15T10:30:00")     // bare datetime → treated as UTC (Z appended)
Badger("2026-03-15")              // date-only → UTC midnight
Badger("2026-03-15T10:30:00Z")    // explicit timezone → used as-is
Badger("2026-03-15T10:30:00+02:00") // offset → used as-is
Badger(someDate)                  // copy of a Date object
```

**String parsing rules**
- Date-only strings (`"YYYY-MM-DD"`) → UTC midnight (no `Z` appended — Safari compatibility)
- Strings with `Z` or `±HH:MM` → used as-is
- All other bare datetime strings → `Z` appended automatically
- Empty string → `isValid()` returns `false`

---

### `Badger.fromLocal(date, time)` — local wall-clock

Use when a date+time pair from a form or picker represents **local time**, not UTC.

```ts
const dt = Badger.fromLocal("2026-05-22", "00:15");
dt.hour;      // 0  — local midnight, not shifted to UTC
dt.dayOfWeek; // 5  — Friday, correct local day
```

`date` must be `"YYYY-MM-DD"` and `time` must be `"HH:mm"` — throws `RangeError` if either format is wrong.

---

### `Badger.min()` / `Badger.max()`

```ts
const earliest = Badger.min(deadline, today, cutoff);
const latest   = Badger.max(deadline, today, cutoff);
```

Throws `RangeError` if called with no arguments.

---

### `Badger.range(start, end, unit)` — date range iterator

Returns an array of `Badger` instances from `start` (inclusive) to `end` (exclusive). Day ranges are normalised to midnight; week and month ranges preserve the input time. Throws `RangeError` if either date is invalid.

```ts
// Build a calendar month grid
Badger.range("2026-06-01", "2026-07-01", "day")
// → [Jun 1, Jun 2, … Jun 30]  — 30 Badger instances at midnight

// Weekly report headers
Badger.range(startOfQuarter, endOfQuarter, "week")

// Monthly chart labels
Badger.range("2026-01-01", "2027-01-01", "month")
// → [Jan 1, Feb 1, Mar 1, … Dec 1]

// Accepts strings, Dates, or Badger instances interchangeably
Badger.range(new Date("2026-06-01"), new Date("2026-06-08"), "day")
Badger.range(Badger("2026-06-01"), "2026-06-08", "day")
```

---

### Getters

```ts
const dt = Badger("2026-07-04T15:30:45.123Z");

dt.year        // 2026
dt.month       // 7        (1-indexed — 1 = January)
dt.day         // 4
dt.hour        // 15
dt.minute      // 30
dt.second      // 45
dt.millisecond // 123
dt.dayOfWeek   // 6        (0 = Sunday … 6 = Saturday, local time)
dt.dayOfYear   // 185      (1–366, local calendar date)
dt.weekYear    // 2026     (ISO week-year — may differ from .year at year boundaries)
dt.quarter     // 3        (1–4)
```

---

### Arithmetic

```ts
dt.add(7, "day")
dt.subtract(1, "month")
dt.add(-2, "hour")

// Duration objects — apply multiple units at once
dt.add({ days: 7, hours: 2, minutes: 30 })
dt.subtract({ months: 1, days: 5 })
```

Singular and plural keys both work (`day`/`days`, `month`/`months`, etc.).

**Units:** `"year"` `"quarter"` `"month"` `"week"` `"day"` `"hour"` `"minute"` `"second"` `"millisecond"`

> Month and year addition clamps to the last valid day — Jan 31 + 1 month → Feb 28/29, not Mar 3.

`add` and `subtract` throw `RangeError` for `NaN` or `Infinity` amounts.

---

### `set()` — replace a single field

```ts
dt.set("year", 2030)         // new Badger with just the year changed
dt.set("month", 12)          // 1-indexed — December
dt.set("hour", 9)

// Clamps to last valid day when the target month is shorter
Badger("2026-01-31").set("month", 2)  // → Feb 28 (not Mar 3)
```

Throws `RangeError` for out-of-range values (`month < 1`, `hour > 23`, etc.) or `NaN`/`Infinity`.

---

### Business days

Locale-aware — uses `Intl.Locale` `weekInfo` to determine the correct weekend for any locale worldwide. Saudi Arabia skips Friday+Saturday; Israel skips Friday+Saturday; most of Europe skips Saturday+Sunday.

**Resolution order for the locale:** explicit argument → `BadgerSettings.defaultLocale` → Saturday+Sunday.

```ts
// Uses BadgerSettings.defaultLocale if set, otherwise Sat+Sun
Badger("2026-06-12").isBusinessDay()    // true  (Friday)
Badger("2026-06-13").isBusinessDay()    // false (Saturday)
Badger("2026-06-15").isWeekend()        // false (Monday)
Badger("2026-06-20").isWeekend()        // true  (Saturday)

// Pass a locale explicitly to override
Badger("2026-06-12").isBusinessDay(new Intl.Locale("ar-SA"))  // false (Friday is weekend in ar-SA)
Badger("2026-06-14").isBusinessDay(new Intl.Locale("ar-SA"))  // true  (Sunday is a workday in ar-SA)

// Add/subtract business days — skips the correct weekend for the locale
Badger("2026-06-12").addBusinessDays(1)                             // Mon Jun 15 (skips Sat+Sun)
Badger("2026-06-12").addBusinessDays(1, new Intl.Locale("ar-SA"))  // Sun Jun 14 (skips Fri+Sat)
Badger("2026-06-15").subtractBusinessDays(1)                        // Fri Jun 12

// Set once, works everywhere
BadgerSettings.setLocale(new Intl.Locale("ar-SA"));
Badger("2026-06-12").isBusinessDay()   // false — picks up ar-SA from global settings
Badger("2026-06-12").addBusinessDays(1) // Sun Jun 14 — same
```

No other date library does this natively.

---

### Countdown

Returns `{ days, hours, minutes, seconds }` until a future date, or `null` if the date has passed. `null` makes the expired state explicit — TypeScript enforces you handle it.

```ts
Badger("2026-12-25").countdown()
// { days: 193, hours: 4, minutes: 22, seconds: 11 }

Badger("2025-01-01").countdown()
// null — already passed

// Custom anchor (useful for tests and server-side rendering)
Badger("2026-12-25").countdown(new Date("2026-06-01T00:00:00Z"))
// { days: 207, hours: 0, minutes: 0, seconds: 0 }

// Pair with Sett.formatCountdown() for a formatted display string
Sett(new Date()).formatCountdown(Badger("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"  (Node 24+ / modern browsers)
// null if past
```

---

### Boundaries

All `startOf` / `endOf` operations are in **local time** and never mutate the original.

```ts
dt.startOf("year")    // 1 Jan, 00:00:00.000  (local midnight)
dt.startOf("quarter") // first day of the quarter, local midnight
dt.startOf("month")   // first of the month, local midnight
dt.startOf("week")    // Monday 00:00:00.000  (ISO 8601, local time)
dt.startOf("day")     // 00:00:00.000
dt.startOf("hour")
dt.startOf("minute")
dt.startOf("second")
dt.startOf("millisecond")  // no-op — returns clone

dt.endOf("year")      // 31 Dec, 23:59:59.999  (local)
dt.endOf("quarter")
dt.endOf("month")     // last day, 23:59:59.999
dt.endOf("week")      // Sunday 23:59:59.999
dt.endOf("day")       // 23:59:59.999
dt.endOf("hour")
dt.endOf("minute")
dt.endOf("second")
dt.endOf("millisecond")  // no-op — returns clone
```

---

### Comparison

```ts
dt.isBefore(other)
dt.isAfter(other)
dt.isSameOrBefore(other)
dt.isSameOrAfter(other)
dt.isSame(other)             // exact millisecond
dt.isSame(other, "day")      // same calendar day
dt.isSame(other, "month")    // same month
dt.isSame(other, "week")     // same ISO week (accounts for year boundaries)
dt.isSame(other, "quarter")
```

**`isBetween`** — exclusive by default, configurable:

```ts
date.isBetween(open, close)                                      // false at boundaries
open.isBetween(open, close, { includeStart: true })              // true at start
close.isBetween(open, close, { includeEnd: true })               // true at end
date.isBetween(open, close, { includeStart: true, includeEnd: true })
```

Throws `RangeError` if either boundary is an invalid Date, or if `start` is after `end`.

**`clamp`** — constrain a date to a range:

```ts
Badger("2025-01-01").clamp(min, max)  // → min  (clamped early)
Badger("2027-01-01").clamp(min, max)  // → max  (clamped late)
Badger("2026-06-15").clamp(min, max)  // → unchanged
```

Throws `RangeError` if either bound is invalid, or if `min` is after `max`.

**Convenience helpers:**

```ts
dt.isToday()       // local calendar day
dt.isYesterday()
dt.isTomorrow()
dt.isPast()        // strictly before now
dt.isFuture()      // strictly after now
dt.isWeekend()     // local day of week — respects BadgerSettings.defaultLocale
dt.isWeekday()     // local day of week — respects BadgerSettings.defaultLocale
```

All comparisons accept `Badger | Date`.

---

### Diff

```ts
a.diff(b, "hour")        // 1    — whole number, floored
a.diff(b, "hour", true)  // 1.5  — fractional
b.diff(a, "minute")      // -90  — negative when b is before a
a.diff(b, "second", true) // fractional seconds
```

`diff("day")` and `diff("week")` use calendar dates, not raw milliseconds — **DST-safe**. `diff("month")` and `diff("year")` are calendar-based, not approximated.

---

### Other utilities

```ts
dt.toISOString()              // "2026-03-15T10:30:00.000Z"
dt.toDate()                   // copy of underlying Date — mutations don't affect Badger
dt.toUnixTimestamp()          // Unix seconds (floored)
dt.toMillisecondTimestamp()   // Unix milliseconds
dt.toObject()                 // { year, month, day, hour, minute, second, millisecond }
dt.clone()                    // independent copy
dt.isValid()                  // false for invalid/corrupt dates — check before using
dt.getDaysInMonth()           // 28–31
dt.daysInYear()               // 365 or 366 (NaN for invalid dates)
dt.getWeekNumber()            // ISO 8601 week number (1–53)
dt.isLeapYear()
```

---

### Invalid dates

`isValid()` is the guard. Methods called on an invalid `Badger` follow consistent rules:
- **Boolean methods** (`isWeekend`, `isWeekday`, `isBusinessDay`, etc.) → `false`
- **Numeric methods** (`diff`, `year`, `dayOfYear`, etc.) → `NaN`
- **Countdown** → `null`
- **Business day iterators** (`addBusinessDays`, `subtractBusinessDays`) → return invalid clone immediately (no iteration)

```ts
const bad = Badger("not-a-date");
bad.isValid()      // false
bad.isWeekend()    // false  (not true — the bug-free path)
bad.isWeekday()    // false  (not true)
bad.countdown()    // null
bad.addBusinessDays(5)  // returns invalid clone, doesn't iterate
```

---

## Sett — locale-aware formatting

Defaults to `en-GB` / `Europe/London` unless overridden by `BadgerSettings`.

### Construction

```ts
Sett()                                              // now, global defaults
Sett(someDate)
Sett(someDate, new Intl.Locale("sv-SE"))
Sett(someDate, new Intl.Locale("sv-SE"), {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
})
```

### Display

```ts
const s = Sett(new Date("2026-03-15T14:30:45Z"));

s.formatDate()           // "15/03/2026, 15:30:45"  (en-GB / London)
s.formatDateOnly()       // "15/03/2026"
s.formatTimeOnly()       // "15:30:45"   ← auto 24h for en-GB
s.getDayName()           // "Sunday"     (also: "short" → "Sun" | "narrow" → "S")
s.getMonthName()         // "March"      (also: "short" → "Mar" | "narrow" → "M")
s.getDaysOfTheWeek()     // ["Monday", "Tuesday", …]  — starts from locale's first day
s.getMonthsOfTheYear()   // ["January", …, "December"]
```

### Hour cycle — automatic 12h/24h per locale

`formatTimeOnly()` reads `Intl.Locale.hourCycles` and switches automatically. No configuration needed.

```ts
Sett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("en-US"), { timeZone: "UTC" }).formatTimeOnly()
// "03:30:45 PM"  ← 12-hour for en-US

Sett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("de-DE"), { timeZone: "UTC" }).formatTimeOnly()
// "15:30:45"     ← 24-hour for de-DE

Sett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("ar-SA"), { timeZone: "UTC" }).formatTimeOnly()
// 12-hour format in Arabic numerals
```

### Locale-aware calendar

`isWeekend()` and `startOfWeek()` use `Intl.Locale.weekInfo` — correct for every locale worldwide. Both use **local time**, so they give the right answer even for dates near UTC midnight in non-UTC timezones.

```ts
// Saudi Arabia: Friday+Saturday are the weekend
Sett(new Date("2026-06-05"), new Intl.Locale("ar-SA")).isWeekend()  // true  (Friday)
Sett(new Date("2026-06-07"), new Intl.Locale("ar-SA")).isWeekend()  // false (Sunday is a workday)

// Week start varies by locale — returns local midnight of the first day of the week
Sett(new Date("2026-06-10T12:00:00"), new Intl.Locale("en-US")).startOfWeek()
// → Date at local midnight of Sunday Jun 7

Sett(new Date("2026-06-10T12:00:00"), new Intl.Locale("en-GB")).startOfWeek()
// → Date at local midnight of Monday Jun 8
```

### Relative time

```ts
s.formatRelative()             // "3 hours ago" / "in 2 days" / "last month"
s.formatRelative(anchorDate)   // relative to a specific date instead of now
```

Month and year thresholds are calendar-based, not approximate. 28 days in the same calendar month is "4 weeks ago", not "1 month ago".

Throws `RangeError` if `currentDate` or `relativeTo` is invalid — no silent garbage output.

### Duration formatting

Uses `Intl.DurationFormat` — the platform formats the string in the locale's natural language, with no hand-rolled logic.

> Requires Node ≥ 24, Chrome 127+, Firefox 127+, Safari 17.4+. Throws in older environments.

```ts
Sett(new Date(), new Intl.Locale("en-GB")).formatDuration({ hours: 3, minutes: 22 })
// "3 hours and 22 minutes"

Sett(new Date(), new Intl.Locale("de-DE")).formatDuration({ hours: 2, minutes: 30 })
// "2 Stunden und 30 Minuten"

Sett(new Date(), new Intl.Locale("fr-FR")).formatDuration({ days: 1, hours: 4 })
// "1 jour et 4 heures"

// Pair with diff() — elapsed time in one line
const minutes = Badger(startTime).diff(Badger(), "minute");
Sett(new Date()).formatDuration({ minutes })
// "47 minutes"
```

### Countdown display

`formatCountdown()` combines `Badger.countdown()` and `formatDuration()` into one call. Returns `null` if the date is in the past — TypeScript enforces you handle it.

```ts
Sett(new Date()).formatCountdown(Badger("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"

Sett(new Date()).formatCountdown(Badger("2025-01-01"))
// null — date is in the past
```

Live timer in React Native — updates every second, switches to `"Expired"` automatically:

```tsx
function CountdownLabel({ endsAt }: { endsAt: string }) {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        const tick = () => setLabel(
            Sett(new Date()).formatCountdown(Badger(endsAt)) ?? "Expired"
        );
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endsAt]);

    return <Text>{label}</Text>;
}
```

### Backend serialisation

```ts
s.formatForBackend()              // "2026-03-15T10:30:45.000Z"
s.formatForBackendToStartOfDay()  // midnight in configured timezone → UTC ISO
s.formatForBackendToEndOfDay()    // 23:59:59.999 in configured timezone → UTC ISO
```

Both start/end of day are **DST-safe** — the correct UTC offset is resolved for that specific calendar date, not approximated.

```ts
// London BST (UTC+1) — midnight on 15 Jul = 23:00 UTC on 14 Jul
Sett("2026-07-15T12:00:00Z").formatForBackendToStartOfDay()
// "2026-07-14T23:00:00.000Z"

// London GMT (UTC+0) — midnight on 15 Jan = 00:00 UTC
Sett("2026-01-15T12:00:00Z").formatForBackendToStartOfDay()
// "2026-01-15T00:00:00.000Z"
```

---

## BadgerSettings — global defaults

Set once at app startup. Every `Sett()` and `Badger()` call without an explicit locale inherits these automatically.

```ts
import { BadgerSettings } from "badger-time";

BadgerSettings.defaultLocale   = new Intl.Locale("sv-SE");
BadgerSettings.defaultTimeZone = "Europe/Stockholm";

// No locale arg needed anywhere in the app
Sett(order.deliveryTime).formatDate()       // sv-SE / Stockholm
Sett(order.deliveryTime).isWeekend()        // uses sv-SE weekInfo
Sett(order.deliveryTime).formatTimeOnly()   // 24h (sv-SE is 24-hour)

// Badger picks it up too — business day methods use defaultLocale automatically
Badger("2026-06-12").isBusinessDay()        // respects sv-SE weekend definition
Badger("2026-06-12").addBusinessDays(3)     // skips sv-SE weekends

// Explicit locale always wins over global default
Sett(date, new Intl.Locale("fr-FR")).formatDate()  // → fr-FR regardless of global
```

### Reactive language switching

`setLocale()` updates the global **and** notifies all active subscribers atomically. One call, entire app updates.

```ts
const unsub = BadgerSettings.subscribe(locale => {
    console.log("Switched to", locale.baseName);
});

BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
// → "Switched to fr-FR"

unsub(); // stop listening — good practice in component cleanup
```

### React Native

```tsx
// localeContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { BadgerSettings } from "badger-time";

const LocaleContext = createContext<Intl.Locale>(new Intl.Locale("en-GB"));

export function LocaleProvider({ children }) {
    const [locale, setLocale] = useState(
        BadgerSettings.defaultLocale ?? new Intl.Locale("en-GB")
    );

    // Subscribe to locale changes — unsubscribes automatically on unmount
    useEffect(() => BadgerSettings.subscribe(setLocale), []);

    return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
```

```tsx
// Language switcher — one call updates every date in the app
<Button
    title="Français"
    onPress={() => BadgerSettings.setLocale(new Intl.Locale("fr-FR"))}
/>
```

```tsx
// Any component — re-renders automatically on locale change
function OrderCard({ order }) {
    const locale = useLocale();
    return (
        <View>
            <Text>{Sett(order.deliveryTime, locale).formatDate()}</Text>
            <Text>{Sett(order.deliveryTime, locale).formatRelative()}</Text>
        </View>
    );
}
```

### React (web)

```tsx
useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved) BadgerSettings.setLocale(new Intl.Locale(saved));
}, []);
```

### Vue

```ts
export const appLocale = ref(new Intl.Locale("en-GB"));
BadgerSettings.subscribe(locale => { appLocale.value = locale; });

// In component
const formatted = computed(() => Sett(order.deliveryTime, appLocale.value).formatDate());
```

### Vanilla JS

```ts
BadgerSettings.subscribe(locale => {
    document.querySelectorAll<HTMLElement>("[data-timestamp]").forEach(el => {
        el.textContent = Sett(new Date(el.dataset.timestamp!), locale).formatRelative();
    });
});
```

### `reset()`

Clears locale, timezone, and all subscribers. Essential in tests to prevent state leaking between test cases.

```ts
afterEach(() => BadgerSettings.reset());
```

---

## Real-world recipes

### Delivery app — order card

```ts
const order = { dueAt: "2026-06-15T18:30:00Z", locale: new Intl.Locale("en-GB") };

// Is it due today?
Badger(order.dueAt).isToday()

// How many minutes until due?
Badger(order.dueAt).diff(Badger(), "minute")

// Display the time in the customer's locale (12h/24h automatic)
Sett(order.dueAt, order.locale).formatTimeOnly()

// Countdown display
Sett(new Date(), order.locale).formatCountdown(Badger(order.dueAt))
// "3 hours and 22 minutes"  — or null if already past due
```

### HR system — notice periods

```ts
// Add 30 business days, skipping the correct weekends for the employee's country
const lastDay = Badger(terminationDate).addBusinessDays(30, employeeLocale);

// Count remaining working days
const workingDays = Badger.range(Badger(), lastDay, "day")
    .filter(d => d.isBusinessDay(employeeLocale)).length;

// "Your last working day is Monday 27 July 2026"
Sett(lastDay.toDate(), employeeLocale).formatDateOnly()
```

### Calendar UI — month grid

```ts
const days = Badger.range(
    Badger("2026-06-01").startOf("month"),
    Badger("2026-06-01").endOf("month").add(1, "day"),
    "day"
);

// Locale-aware week start — US calendars begin Sunday, UK begin Monday
const weekStart = Sett(new Date(), userLocale).startOfWeek();
const weekDayNames = Sett(new Date(), userLocale).getDaysOfTheWeek("short");
// en-GB: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
// en-US: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
```

### Event countdown — live timer

```tsx
function EventBanner({ eventDate }: { eventDate: string }) {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        const tick = () => setLabel(
            Sett(new Date()).formatCountdown(Badger(eventDate)) ?? "Event has started!"
        );
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [eventDate]);

    return <Text>{label}</Text>;
}
```

### Backend query — this week's data

```ts
const locale = new Intl.Locale("en-GB");
const tz = "Europe/London";
const opts = { timeZone: tz, year: "numeric" as const, month: "2-digit" as const,
               day: "2-digit" as const, hour: "2-digit" as const,
               minute: "2-digit" as const, second: "2-digit" as const, hour12: false };

// DST-safe week boundaries — correct even on the day clocks change
const weekStart = Sett(new Date(), locale, opts);
const weekEnd   = Sett(Badger().endOf("week").toDate(), locale, opts);

const from = weekStart.formatForBackendToStartOfDay();
const to   = weekEnd.formatForBackendToEndOfDay();

await fetch(`/api/orders?from=${from}&to=${to}`);
```

### Comparing dates across timezones

```ts
// Server returns UTC timestamps — Badger handles them correctly
const serverDate = Badger("2026-06-15T22:00:00Z");

// User is in CEST (UTC+2) — this is 00:00 local on Jun 16
serverDate.isToday()    // depends on the user's local timezone — correct
serverDate.dayOfWeek    // local day of week — correct for the user's timezone
serverDate.isWeekend()  // local weekend check — correct

// Backend always gets UTC regardless of user timezone
Sett(serverDate.toDate()).formatForBackend()
// "2026-06-15T22:00:00.000Z"
```

---

## License

UNLICENSED — private package.
