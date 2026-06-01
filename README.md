# badger-time

> Lightweight date engine and formatter. Zero runtime dependencies. No moment. No date-fns.

---

## Install

```bash
npm install badger-time
```

---

## Overview

badger-time ships two classes:

| Class | Purpose |
|---|---|
| `Badger` | Immutable-style date arithmetic, comparison, and boundary operations |
| `BadgerSett` | Locale-aware formatting built on `Intl.DateTimeFormat` |

All `Badger` methods return a **new instance** — the original is never mutated.

---

## Badger

### Construction

```ts
import { Badger } from "badger-time";

new Badger()                           // current time
new Badger("2026-03-15T10:30:00")     // bare datetime → treated as UTC (Z appended)
new Badger("2026-03-15")              // date-only → UTC midnight
new Badger("2026-03-15T10:30:00Z")    // explicit timezone → used as-is
new Badger(someDate)                  // copy of a Date object
```

**String parsing rules**
- Date-only strings (`"YYYY-MM-DD"`) are parsed as UTC midnight — the ECMAScript spec handles this without needing a `Z` suffix (which Safari rejects).
- Strings with a timezone indicator (`Z` or `±HH:MM`) are used as-is.
- All other bare datetime strings get `"Z"` appended automatically.

### `Badger.fromLocal(date, time)` — local wall-clock factory

Use when a `"YYYY-MM-DD"` + `"HH:mm"` pair represents **local time** (e.g. a user-selected pickup slot). The standard constructor would shift it by the UTC offset.

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
const dt = new Badger("2026-07-04T15:30:45.123Z");

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
new Badger("2026-01-31").add(1, "month").toISOString()
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
const a = new Badger("2026-06-15T10:30:00Z");
const b = new Badger("2026-06-15T22:00:00Z");

a.isSame(b)         // false — different timestamps
a.isSame(b, "day")  // true  — same calendar day
a.isSame(b, "hour") // false — different hour
```

**`isBetween(start, end, options?)`** — both boundaries are **exclusive** by default. Throws `RangeError` if `start > end`.

```ts
const open  = new Badger("2026-06-01T00:00:00Z");
const close = new Badger("2026-06-30T00:00:00Z");
const date  = new Badger("2026-06-15T00:00:00Z");

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
const min = new Badger("2026-01-01T00:00:00Z");
const max = new Badger("2026-12-31T00:00:00Z");

new Badger("2025-06-15T00:00:00Z").clamp(min, max) // → min
new Badger("2027-06-15T00:00:00Z").clamp(min, max) // → max
new Badger("2026-06-15T00:00:00Z").clamp(min, max) // → unchanged
```

All comparisons accept `Badger | Date`.

---

### Diff

Returns a whole number by default. Pass `float: true` for a fractional result.

```ts
const a = new Badger("2026-06-15T10:30:00Z");
const b = new Badger("2026-06-15T09:00:00Z");

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

Locale-aware formatter built on `Intl.DateTimeFormat`. Defaults to `en-GB` / `Europe/London`.

### Construction

```ts
import { BadgerSett } from "badger-time";

new BadgerSett()                                             // now, en-GB, London
new BadgerSett(someDate)
new BadgerSett(someDate, new Intl.Locale("sv-SE"))
new BadgerSett(someDate, new Intl.Locale("sv-SE"), {        // full control
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
})
```

### Display

```ts
const bs = new BadgerSett(new Date("2026-03-15T10:30:45Z"));

bs.formatDate()           // "15/03/2026, 10:30:45"
bs.formatDateOnly()       // "15/03/2026"
bs.formatTimeOnly()       // "10:30:45"
bs.getDayName()           // "Sunday"  (also: "short" | "narrow")
bs.getMonthName()         // "March"   (also: "short" | "narrow")
bs.getDaysOfTheWeek()     // ["Monday", …, "Sunday"]  — starts from locale's first day of week
bs.getMonthsOfTheYear()   // ["January", …, "December"]
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

## Common patterns

```ts
// Is a delivery slot today?
new Badger(order.deliveryTime).isToday();

// Minutes until an order is due
new Badger(order.dueAt).diff(new Badger(), "minute");

// Progress through a shift (fractional hours)
new Badger().diff(new Badger(shiftStart), "hour", true);

// Is a booking within an open window (inclusive of opening time)?
slot.isBetween(openingTime, closingTime, { includeStart: true });

// Clamp a date to never exceed a deadline
const effective = Badger.min(selectedDate, deadline);

// Start of today in UTC for a backend query
new BadgerSett(new Badger().toDate()).formatForBackendToStartOfDay();

// Localised opening hours label (Stockholm locale)
new BadgerSett(
    new Badger(openingHour).toDate(),
    new Intl.Locale("sv-SE")
).formatTimeOnly();
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
| Bundle size (min+gzip) | ~72 KB | ~14 KB | ~23 KB | < 5 KB |

---

## License

UNLICENSED — private package.
