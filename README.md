<p align="center">
  <img src="https://raw.githubusercontent.com/lrprice79/badger-time/HEAD/assets/purple-brock-icon.png" width="140" alt="badger-time">
</p>

<h1 align="center">badger-time</h1>

> The date library that actually understands where your users are sett.

A small, fast library for working with dates and times in JavaScript and TypeScript apps. No extra packages required — it works entirely with tools already built into browsers and Node.js. We dug deep so you don't have to.

---

## What does it do?

Working with dates sounds simple — until your app needs to handle users in different countries, different time zones, and different date formats. Most date libraries assume everyone works Monday to Friday, weeks start on Monday, and times are shown in 24-hour format. That's wrong for a large part of the world.

**badger-time** handles this automatically:

- **Weekends differ by country.** In Saudi Arabia, the weekend is Friday and Saturday. In Israel it is also Friday and Saturday. In most of the world it is Saturday and Sunday. badger-time knows this for every locale (country/language setting) in the world.
- **Week starts differ by country.** In the US, weeks start on Sunday. In the UK and most of Europe, they start on Monday. badger-time picks the right one automatically.
- **Time format differs by country.** In the US, people use 12-hour clocks (3:30 PM). In Germany, 24-hour clocks (15:30). badger-time switches automatically based on locale.
- **Daylight saving time is handled correctly.** Calculating "start of today" or "days between two dates" can give wrong answers when clocks change. badger-time does this correctly.

You set your app's locale once at startup — every date operation and every formatted date in your app picks it up automatically.

---

## Install

```bash
npm install @purple-brock/time
# or
yarn add @purple-brock/time
```

**Requires Node.js 20 or higher.** The library will throw an error on startup if you are running an older version.

> `formatDuration` and `formatCountdown` require Node 24+. Everything else in the library works on Node 20+.

---

## How does it compare to other libraries?

| Feature | moment | date-fns | luxon | badger-time |
|---|:---:|:---:|:---:|:---:|
| No extra packages needed | ✗ | ✗ | ✅ | ✅ |
| Dates are never modified in place | ✗ | ✅ | ✅ | ✅ |
| No `new` keyword required | ✗ | ✅ | ✗ | ✅ |
| Uses the platform's built-in locale tools — no separate language files | ✗ | ✗ | ✅ | ✅ |
| Correct day/week differences across clock changes | ✗ | ✗ | ✅ | ✅ |
| Correct start/end of day across clock changes | ✗ | via date-fns-tz | ✅ | ✅ |
| Create a date from a local time (not UTC) | ✗ | ✗ | ✅ | ✅ |
| Fractional differences (e.g. 1.5 hours) | ✅ | ✅ | ✅ | ✅ |
| Inclusive range options | ✅ | partial | ✗ | ✅ |
| Correct weekends for every country | ✗ | ✗ | ✗ | ✅ |
| Correct week start for every country | ✗ | ✗ | ✗ | ✅ |
| 12h/24h clock chosen automatically by country | ✗ | ✗ | ✗ | ✅ |
| Business day calculations per country | ✗ | ✗ | ✗ | ✅ |
| Date range generator | ✗ | ✗ | ✗ | ✅ |
| Countdown that returns `null` for past dates | ✗ | ✗ | ✗ | ✅ |
| Duration formatting in the user's language | ✗ | ✗ | ✗ | ✅ |
| Reactive global locale (one call updates the whole app) | ✗ | ✗ | ✗ | ✅ |
| Bundle size (minified + gzipped) | ~72 KB | ~14 KB | ~23 KB | **~5.1 KB** |

---

## Quick start

```ts
import { Badger, Sett, BadgerSettings } from "@purple-brock/time";

// Tell the library which country/language your app is running in.
// Do this once at startup — every date operation will use it automatically.
BadgerSettings.setLocale(new Intl.Locale("en-US"));
BadgerSettings.defaultTimeZone = "America/New_York";

// Add 7 days to a date
Badger("2026-06-15").add(7, "day").toISOString()
// "2026-06-22T00:00:00.000Z"

// Check if an order's delivery time is today
Badger(order.deliveryTime).isToday()

// Format a date for display — picks up locale automatically
Sett(order.deliveryTime).formatDate()        // "06/15/2026, 03:30:45 PM"
Sett(order.deliveryTime).formatRelative()    // "in 2 hours"
Sett(order.deliveryTime).formatTimeOnly()    // "03:30:45 PM"  (12-hour because en-US)

// Show a countdown — returns null automatically when the date has passed
Sett(new Date()).formatCountdown(new Date("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"
```

---

## API

### The three main exports

| Export | What it does |
|---|---|
| `Badger(date?)` | Date arithmetic — add/subtract time, compare dates, check if a date is today/past/future, generate ranges, business day calculations |
| `Sett(date?, locale?, options?)` | Formatting — display dates in the user's language, relative time ("2 hours ago"), countdown timers, sending dates to a backend |
| `BadgerSettings` | Global defaults — set the locale and time zone once, subscribe to locale changes |

No `new` keyword is needed anywhere. Every operation returns a new value — the original date is never changed.

### TypeScript types

If you are using TypeScript, the factory names double as the instance types — so
`Badger` and `Sett` can be used as **both a value and a type**, with no separate
type import:

```ts
import { Badger, Sett } from "@purple-brock/time";

function addBusinessDays(date: Badger, n: number): Badger {
    return date.addBusinessDays(n);
}

function formatForDisplay(date: Badger): Sett {
    return Sett(date.toDate());
}
```

The explicit instance-type aliases `BadgerInstance` / `BadgerSettInstance` remain
exported and are equivalent — use whichever reads better:

```ts
import type { BadgerInstance, BadgerSettInstance } from "@purple-brock/time";
```

---

## Badger — working with dates

### Creating a date

```ts
Badger()                              // right now
Badger("2026-03-15T10:30:00")        // a specific date and time (treated as UTC)
Badger("2026-03-15")                 // a specific date (local midnight)
Badger("2026-03-15T10:30:00Z")       // explicit time zone offset — used as-is
Badger("2026-03-15T10:30:00+02:00")  // with a +2 hour offset — used as-is
Badger(someDate)                     // copy of a JavaScript Date object
```

**How strings are interpreted:**
- A date-only string like `"2026-03-15"` is anchored to **local midnight**, so its calendar day is correct in every time zone — reading `.day`, adding months, or building a range never drifts to the previous day for users west of UTC
- A string that already includes a time zone (ends in `Z` or `+02:00`) is used exactly as written
- Any other date-time string (no time zone) is treated as UTC

---

### Creating a date from local time

Use `Badger.fromLocal()` when a date and time come from a form or picker and represent the *user's local time*, not UTC.

```ts
// The user selected "22 May 2026 at 00:15" in their local time zone
const dt = Badger.fromLocal("2026-05-22", "00:15");
dt.hour;      // 0  — local midnight, not shifted
dt.dayOfWeek; // 5  — Friday in local time
```

The date must be `"YYYY-MM-DD"` and the time must be `"HH:mm"`. An error is thrown if the format is wrong or if the date doesn't exist (e.g. `"2026-02-30"`).

---

### Finding the earliest or latest date

```ts
const earliest = Badger.min(deadline, today, cutoff);
const latest   = Badger.max(deadline, today, cutoff);
```

Throws an error if called with no arguments or if any input is an invalid date. Filter out invalid dates first:

```ts
const valid = dates.filter(d => d.isValid());
const earliest = valid.length ? Badger.min(...valid) : null;
```

---

### Generating a list of dates (range)

Returns an array of dates from `start` up to (but not including) `end`. Useful for building calendars, chart labels, and report headers.

```ts
// Every day in June 2026
Badger.range("2026-06-01", "2026-07-01", "day")
// → [Jun 1, Jun 2, … Jun 30]  — 30 dates

// One entry per week across a quarter
Badger.range(startOfQuarter, endOfQuarter, "week")

// Monthly labels for a chart
Badger.range("2026-01-01", "2027-01-01", "month")
// → [Jan 1, Feb 1, Mar 1, … Dec 1]

// Strings, plain Dates, and Badger instances all work interchangeably
Badger.range(new Date("2026-06-01"), new Date("2026-06-08"), "day")
```

> Monthly ranges re-anchor to the **start's day-of-month**, clamping per month rather than drifting. A range from January 31 yields Jan 31, Feb 28, Mar 31, Apr 30, May 31 — not a steady slide down to the 28th.

---

### Reading parts of a date

```ts
const dt = Badger("2026-07-04T15:30:45.123Z");

dt.year        // 2026
dt.month       // 7        (1 = January, 12 = December)
dt.day         // 4
dt.hour        // 15
dt.minute      // 30
dt.second      // 45
dt.millisecond // 123
dt.dayOfWeek   // 6        (0 = Sunday, 1 = Monday … 6 = Saturday, in local time)
dt.dayOfYear   // 185      (which day of the year this is, 1–366)
dt.weekYear    // 2026     (the ISO year for the week — may differ at year boundaries)
dt.quarter     // 3        (1–4)
```

---

### Adding and subtracting time

```ts
dt.add(7, "day")          // 7 days later
dt.subtract(1, "month")   // 1 month earlier
dt.add(-2, "hour")        // 2 hours earlier (negative numbers work)

// Apply several units at once
dt.add({ days: 7, hours: 2, minutes: 30 })
dt.subtract({ months: 1, days: 5 })
```

Singular and plural both work: `"day"` and `"days"`, `"month"` and `"months"`, etc.

**Available units:** `"year"`, `"quarter"`, `"month"`, `"week"`, `"day"`, `"hour"`, `"minute"`, `"second"`, `"millisecond"`

> Adding months clamps to the last valid day of the target month — January 31 + 1 month becomes February 28 or 29, not March 3.

> Amounts must be **whole numbers**. A fractional amount (e.g. `add(1.5, "day")`) throws a `RangeError` rather than silently truncating to a whole unit — use a finer unit instead (`add(36, "hour")`).

---

### Changing one field

```ts
dt.set("year", 2030)    // returns a new date with just the year changed
dt.set("month", 12)     // 1-indexed — 12 is December
dt.set("hour", 9)

// Clamps to the last valid day if needed
Badger("2026-01-31").set("month", 2)  // → February 28
```

Throws an error for impossible values (e.g. month 0, hour 25), fractional values (e.g. `set("hour", 1.5)`), or `NaN`.

---

### Business days

This is where badger-time is unique. It uses built-in browser/Node tools to know which days are weekends for every country in the world — no hard-coded rules, no extra data files.

**Weekend rules are looked up in this order:** explicit locale argument → `BadgerSettings.defaultLocale` → Saturday + Sunday.

```ts
// Standard week (Saturday + Sunday weekend)
Badger("2026-06-12").isBusinessDay()    // true  (Friday)
Badger("2026-06-13").isBusinessDay()    // false (Saturday)
Badger("2026-06-15").isWeekend()        // false (Monday)
Badger("2026-06-20").isWeekend()        // true  (Saturday)

// Saudi Arabia uses a Friday + Saturday weekend
Badger("2026-06-12").isBusinessDay(new Intl.Locale("ar-SA"))  // false (Friday is the weekend)
Badger("2026-06-14").isBusinessDay(new Intl.Locale("ar-SA"))  // true  (Sunday is a workday)

// Add business days — skips the correct weekends for the locale
// The count must be a whole number — 1.5 throws an error
Badger("2026-06-12").addBusinessDays(1)                             // Mon Jun 15 (skips Sat+Sun)
Badger("2026-06-12").addBusinessDays(1, new Intl.Locale("ar-SA"))  // Sun Jun 14 (skips Fri+Sat)
Badger("2026-06-15").subtractBusinessDays(1)                        // Fri Jun 12

// Set the locale once — all business day methods pick it up
BadgerSettings.setLocale(new Intl.Locale("ar-SA"));
Badger("2026-06-12").isBusinessDay()    // false — uses ar-SA automatically
Badger("2026-06-12").addBusinessDays(1) // Sun Jun 14
```

No other date library does this natively. Other libraries just don't give a badger.

#### Public holidays (optional)

Weekends are derived automatically; **public holidays are not** — no locale or
region string can tell you that Dec 25 is a UK bank holiday but not a Saudi one,
and badger-time deliberately ships **no holiday data** (that would be a country-
by-country calendar to maintain forever). Instead every business-day method takes
an optional set of holiday dates that *you* supply — typically resolved from a
source like [`date-holidays`](https://www.npmjs.com/package/date-holidays), keyed
off the user's region. Holidays are then skipped exactly like weekends:

```ts
const holidays = ["2026-12-25", "2026-12-28"]; // your dates, e.g. from date-holidays

Badger("2026-12-25").isBusinessDay(new Intl.Locale("en-GB"), holidays);            // false
Badger("2026-12-24").addBusinessDays(1, new Intl.Locale("en-GB"), holidays);       // Dec 29
Badger("2026-12-29").subtractBusinessDays(1, new Intl.Locale("en-GB"), holidays);  // Dec 24
```

Rules that keep this safe:

- **Strict ISO only.** Each entry must be a `YYYY-MM-DD` string. A typo, a
  datetime, or a localized format (`25/12/2026`, `12/25/2026`) throws a
  `RangeError` at the boundary rather than silently never matching — and so do
  impossible dates (`2026-13-25`, `2026-02-30`). Convert any localized user input
  to ISO *before* passing it in; the library never guesses `DD/MM` vs `MM/DD`.
- **Accepts an array or a `Set`** (anything `Iterable<string>`). Omitted or empty
  means "weekends only" — fully backward compatible.
- **Local-date keyed.** A holiday matches the date's *local* calendar day,
  consistent with the locale weekend evaluation (so it's correct near midnight in
  any timezone, not just UTC).
- **Never hangs.** A pathological set that blocks every reachable day makes
  `addBusinessDays`/`subtractBusinessDays` throw a `RangeError` instead of looping
  forever.

---

### Countdown

Returns the time remaining until a future date as days, hours, minutes, and seconds. Returns `null` if the date has already passed — so you always know you need to handle the "expired" case.

```ts
Badger("2026-12-25").countdown()
// { days: 193, hours: 4, minutes: 22, seconds: 11 }

Badger("2025-01-01").countdown()
// null — already passed

// Useful in tests: provide a fixed "now" instead of the real current time
Badger("2026-12-25").countdown(new Date("2026-06-01T00:00:00Z"))
// { days: 207, hours: 0, minutes: 0, seconds: 0 }

// Pair with Sett.formatCountdown() to get a display string
Sett(new Date()).formatCountdown(new Date("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"
// null if the date has passed
```

---

### Start and end of a period

All operations use **local time** and never change the original date.

```ts
dt.startOf("year")    // 1 Jan, midnight (local time)
dt.startOf("quarter") // first day of the quarter, midnight
dt.startOf("month")   // first of the month, midnight
dt.startOf("week")    // Monday 00:00:00 (ISO 8601 standard)
dt.startOf("day")     // midnight (00:00:00.000)
dt.startOf("hour")    // top of the hour
dt.startOf("minute")
dt.startOf("second")

dt.endOf("year")      // 31 Dec, 23:59:59.999 (local time)
dt.endOf("quarter")
dt.endOf("month")     // last day of the month, 23:59:59.999
dt.endOf("week")      // Sunday 23:59:59.999
dt.endOf("day")       // 23:59:59.999
dt.endOf("hour")
dt.endOf("minute")
dt.endOf("second")
```

---

### Comparing dates

```ts
dt.isBefore(other)
dt.isAfter(other)
dt.isSameOrBefore(other)
dt.isSameOrAfter(other)
dt.isSame(other)             // same exact millisecond
dt.isSame(other, "day")      // same calendar day
dt.isSame(other, "month")    // same month
dt.isSame(other, "week")     // same ISO week (handles year boundaries correctly)
dt.isSame(other, "quarter")
```

**Checking if a date is within a range:**

```ts
// By default, the boundaries themselves are not included
date.isBetween(open, close)

// Include the start boundary
open.isBetween(open, close, { includeStart: true })

// Include the end boundary
close.isBetween(open, close, { includeEnd: true })

// Include both
date.isBetween(open, close, { includeStart: true, includeEnd: true })
```

Throws an error if either boundary is invalid, or if `start` is after `end`.

**Clamping a date to a range:**

```ts
// Returns the closest valid date within the range
Badger("2025-01-01").clamp(min, max)  // → min  (too early, clamped to start)
Badger("2027-01-01").clamp(min, max)  // → max  (too late, clamped to end)
Badger("2026-06-15").clamp(min, max)  // → unchanged (already within range)
```

**Quick helpers:**

```ts
dt.isToday()       // is this date today (in local time)?
dt.isYesterday()
dt.isTomorrow()
dt.isPast()        // is this date before right now?
dt.isFuture()      // is this date after right now?
dt.isWeekend()     // is this a weekend day? (respects BadgerSettings.defaultLocale)
dt.isWeekday()     // is this a working day? (respects BadgerSettings.defaultLocale)
```

All comparisons accept either a `Badger` instance or a plain JavaScript `Date`.

---

### Difference between two dates

```ts
a.diff(b, "hour")        // 1    — whole hours, rounded down
a.diff(b, "hour", true)  // 1.5  — fractional (pass true as the third argument)
b.diff(a, "minute")      // -90  — negative when b is before a
```

Day and week differences account for daylight saving time correctly — they count calendar days, not raw hours.

---

### Other utilities

```ts
dt.toISOString()              // "2026-03-15T10:30:00.000Z"  — UTC instant; throws if invalid
dt.toLocalISODate()           // "2026-03-15"  — LOCAL calendar date; use this, never toISOString().slice(0,10)
dt.toDate()                   // a plain JavaScript Date (a copy — changes won't affect the Badger)
dt.toUnixTimestamp()          // seconds since 1 Jan 1970 (floored)
dt.toMillisecondTimestamp()   // milliseconds since 1 Jan 1970
dt.toObject()                 // { year, month, day, hour, minute, second, millisecond }
dt.clone()                    // independent copy
dt.isValid()                  // false if the date is corrupt or unparseable — always check this
dt.getDaysInMonth()           // how many days are in the date's month (28–31)
dt.daysInYear()               // 365 or 366 (NaN if invalid)
dt.getWeekNumber()            // ISO 8601 week number (1–53)
dt.isLeapYear()               // is this a leap year?
```

---

### Invalid dates

Always call `isValid()` before using a `Badger` that was created from user input or an external source. When a date is invalid, methods return safe fallback values rather than crashing:

| Type of method | Examples | Returns when invalid |
|---|---|---|
| Yes/no checks | `isWeekend`, `isBusinessDay`, `isLeapYear`, `isPast`, `isBefore`… | `false` |
| Number values | `year`, `month`, `day`, `diff`, `toUnixTimestamp`… | `NaN` |
| Countdown | `countdown()` | `null` |
| Arithmetic | `add`, `subtract`, `startOf`, `endOf`, `clone` | An invalid Badger (further chaining stays invalid) |
| Business day iteration | `addBusinessDays`, `subtractBusinessDays` | Invalid clone — no looping |
| `toISOString()` / `toLocalISODate()` | — | Throws an error (there is no meaningful string to produce) |
| `Sett` formatters | `formatDate`, `formatTimeOnly`, `getDayName`… | Throw an error |

```ts
const bad = Badger("not-a-date");
bad.isValid()            // false — check this first
bad.isWeekend()          // false
bad.countdown()          // null
bad.daysInYear()         // NaN
bad.addBusinessDays(5)   // returns an invalid clone — no looping happens

// toISOString is the one that throws — it can't produce a string for an invalid date
bad.toISOString()        // Error: Badger.toISOString(): date is not valid…

// Badger.min and Badger.max also throw on invalid input — filter first
const dates = [Badger("2026-01-01"), Badger("bad"), Badger("2026-06-15")];
const valid = dates.filter(d => d.isValid());
Badger.min(...valid)     // Badger("2026-01-01")
```

---

## Sett — displaying and formatting dates

`Sett` turns a date into a string your users can read. It uses the platform's built-in formatting tools, so it automatically uses the right format for the user's country — no extra language files, no manual configuration per locale.

Defaults to British English (`en-GB`) and London time unless you override it with `BadgerSettings`.

### Creating a Sett

String inputs follow the same rules as `Badger()` — bare date-time strings are treated as UTC.

```ts
Sett()                                              // now, global defaults
Sett(someDate)                                      // specific date, global defaults
Sett("2026-03-15T10:30:00")                         // string input → treated as UTC
Sett("2026-03-15")                                  // date-only → LOCAL midnight
Sett(someDate, new Intl.Locale("sv-SE"))            // override the locale
Sett(someDate, new Intl.Locale("sv-SE"), {          // override locale + formatting options
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
})
Sett(someDate, "sv-SE")                             // a plain locale string works too
```

**Hermes caveat:** `formatRelative` needs `Intl.RelativeTimeFormat`, and `formatCountdown` /
`formatDuration` need `Intl.DurationFormat`. Hermes (React Native) doesn't document either, so treat
those three as **web/Node only**. Everything else is Hermes-safe. `formatRelative` rounds to the
nearest month (31 Jan → 1 Mar is "last month").

**Time zone default:** a `Sett` with no `timeZone` option uses `BadgerSettings.defaultTimeZone`, else
the **device's own zone** (it used to fall back to Europe/London).

**React Native / Hermes:** Hermes has no `Intl.Locale`. badger-time never needs one: the
default locale is the plain tag `"en-GB"`, and anything that wants week info (`isWeekend`,
`startOfWeek`, `getDaysOfTheWeek`, the business-day methods) or the 12/24-hour clock
(`formatTimeOnly`) reads it safely, falling back to **Monday-first, Saturday + Sunday weekend**
when `Intl.Locale` is missing. On Hermes, pass locales as **strings** (`"sv-SE"`) rather than
`new Intl.Locale(...)`. Every locale parameter accepts either form (`LocaleInput`).

### Displaying a date

```ts
const s = Sett(new Date("2026-03-15T14:30:45Z"));

s.formatDate()           // "15/03/2026, 14:30:45"  (en-GB format, 24-hour)
s.formatDateOnly()       // "15/03/2026"
s.formatTimeOnly()       // "14:30:45"  (24-hour for en-GB, chosen automatically)
s.getDayName()           // "Sunday"   (pass "short" → "Sun", "narrow" → "S")
s.getMonthName()         // "March"    (pass "short" → "Mar", "narrow" → "M")
s.getDaysOfTheWeek()     // ["Monday", "Tuesday", …]  — starts on the locale's first day
s.getMonthsOfTheYear()   // ["January", …, "December"]
```

### 12-hour vs 24-hour clocks — automatic

`formatTimeOnly()` reads the locale and picks the right clock format. You don't need to configure anything.

```ts
// US English — 12-hour clock
Sett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("en-US"), { timeZone: "UTC" }).formatTimeOnly()
// "03:30:45 PM"

// German — 24-hour clock
Sett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("de-DE"), { timeZone: "UTC" }).formatTimeOnly()
// "15:30:45"

// Arabic (Saudi Arabia) — 12-hour in Arabic numerals
Sett(new Date("2026-06-15T15:30:45Z"), new Intl.Locale("ar-SA"), { timeZone: "UTC" }).formatTimeOnly()
```

### Locale-aware calendar helpers

`isWeekend()` and `startOfWeek()` use the platform's built-in country data — correct for every country worldwide. Both use local time, so they give the right answer even near midnight in non-UTC time zones.

```ts
// Saudi Arabia: Friday and Saturday are the weekend
Sett(new Date("2026-06-05"), new Intl.Locale("ar-SA")).isWeekend()  // true  (Friday)
Sett(new Date("2026-06-07"), new Intl.Locale("ar-SA")).isWeekend()  // false (Sunday is a workday)

// Where does the week start?
Sett(new Date("2026-06-10T12:00:00"), new Intl.Locale("en-US")).startOfWeek()
// → Midnight on Sunday Jun 7  (US weeks start Sunday)

Sett(new Date("2026-06-10T12:00:00"), new Intl.Locale("en-GB")).startOfWeek()
// → Midnight on Monday Jun 8  (UK weeks start Monday)
```

### Relative time

Shows how long ago or how far in the future a date is — like "3 hours ago" or "in 2 days".

```ts
s.formatRelative()             // "3 hours ago" / "in 2 days" / "last month"
s.formatRelative(anchorDate)   // relative to a specific date instead of now
```

Month and year thresholds are based on elapsed days, not calendar month boundaries. A 7-day gap that crosses a month boundary shows as "last week", not "last month". 28+ days in different months shows as months.

Throws an error if the date is invalid — never silently shows garbage.

### Duration formatting

Shows a duration in the user's natural language. Uses the platform's built-in tools — no hand-rolled formatting.

> Requires Node 24+, Chrome 127+, Firefox 127+, or Safari 17.4+. If you call this on an older environment it throws — but the rest of `Sett` continues to work fine on Node 20+.

```ts
Sett(new Date(), new Intl.Locale("en-GB")).formatDuration({ hours: 3, minutes: 22 })
// "3 hours and 22 minutes"

Sett(new Date(), new Intl.Locale("de-DE")).formatDuration({ hours: 2, minutes: 30 })
// "2 Stunden und 30 Minuten"  (German)

Sett(new Date(), new Intl.Locale("fr-FR")).formatDuration({ days: 1, hours: 4 })
// "1 jour et 4 heures"  (French)

// Calculate elapsed time and format in one go
const minutes = Badger(startTime).diff(Badger(), "minute");
Sett(new Date()).formatDuration({ minutes })
// "47 minutes"
```

### Countdown display

Combines the countdown calculation with duration formatting in a single call. Returns `null` if the date has passed.

```ts
Sett(new Date()).formatCountdown(new Date("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"

Sett(new Date()).formatCountdown(new Date("2025-01-01"))
// null — date is in the past
```

Live countdown timer in React Native — updates every second, switches to `"Expired"` when done:

```tsx
function CountdownLabel({ endsAt }: { endsAt: string }) {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        const tick = () => setLabel(
            Sett(new Date()).formatCountdown(new Date(endsAt)) ?? "Expired"
        );
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endsAt]);

    return <Text>{label}</Text>;
}
```

### Sending dates to a backend server

These methods convert a date to a standard format (UTC ISO 8601) suitable for sending to a server. Start/end of day calculations account for daylight saving time — the correct UTC offset is resolved for that specific date, not approximated.

```ts
s.formatForBackend()              // "2026-03-15T10:30:45.000Z"
s.formatForBackendToStartOfDay()  // midnight in the configured time zone → UTC
s.formatForBackendToEndOfDay()    // 23:59:59.999 in the configured time zone → UTC
```

```ts
// London is UTC+1 in summer (BST) — midnight on 15 Jul = 23:00 UTC on 14 Jul
Sett("2026-07-15T12:00:00Z").formatForBackendToStartOfDay()
// "2026-07-14T23:00:00.000Z"

// London is UTC+0 in winter (GMT) — midnight on 15 Jan = 00:00 UTC
Sett("2026-01-15T12:00:00Z").formatForBackendToStartOfDay()
// "2026-01-15T00:00:00.000Z"
```

---

## BadgerSettings — global defaults

Set your app's locale and time zone once at startup. Every `Sett()` and `Badger()` call will inherit these automatically, unless you override them at the call site.

```ts
import { BadgerSettings } from "@purple-brock/time";

BadgerSettings.defaultLocale   = new Intl.Locale("sv-SE");
BadgerSettings.defaultTimeZone = "Europe/Stockholm";

// No locale argument needed anywhere in the app
Sett(order.deliveryTime).formatDate()       // formatted in sv-SE / Stockholm
Sett(order.deliveryTime).isWeekend()        // uses Swedish weekend rules
Sett(order.deliveryTime).formatTimeOnly()   // 24-hour (Sweden uses 24-hour clocks)

// Badger picks up the locale too
Badger("2026-06-12").isBusinessDay()        // uses Swedish weekend definition
Badger("2026-06-12").addBusinessDays(3)     // skips Swedish weekends

// You can always override the global locale for a single call
Sett(date, new Intl.Locale("fr-FR")).formatDate()  // → French format, ignores global
```

### Reactive language switching

`setLocale()` updates the global locale and immediately notifies all active listeners. One call, entire app updates.

```ts
// Listen for locale changes
const unsub = BadgerSettings.subscribe(locale => {
    console.log("Switched to", locale.baseName);
});

BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
// → "Switched to fr-FR"

unsub(); // stop listening — important to clean up in components
```

### React Native

```tsx
// localeContext.tsx — wrap your app with this so any component can get the current locale
import { createContext, useContext, useState, useEffect } from "react";
import { BadgerSettings } from "@purple-brock/time";

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
// A language switcher button — one press updates every date in the app
<Button
    title="Français"
    onPress={() => BadgerSettings.setLocale(new Intl.Locale("fr-FR"))}
/>
```

```tsx
// Any component — automatically re-renders when the locale changes
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
// Restore the saved locale when the app loads
useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved) BadgerSettings.setLocale(new Intl.Locale(saved));
}, []);
```

### Vue

```ts
export const appLocale = ref(new Intl.Locale("en-GB"));
BadgerSettings.subscribe(locale => { appLocale.value = locale; });

// In a component
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

### Resetting (for tests)

Clears the locale, time zone, and all subscribers. Essential in tests to prevent settings from leaking between test cases.

```ts
afterEach(() => BadgerSettings.reset());
```

---

## Real-world examples

### Delivery app — order card

```ts
const order = { dueAt: "2026-06-15T18:30:00Z", locale: new Intl.Locale("en-GB") };

// Is the order due today?
Badger(order.dueAt).isToday()

// How many minutes until it's due?
Badger(order.dueAt).diff(Badger(), "minute")

// Display the due time in the customer's locale (12h/24h chosen automatically)
Sett(order.dueAt, order.locale).formatTimeOnly()

// Show a countdown — or null if already past due
Sett(new Date(), order.locale).formatCountdown(new Date(order.dueAt))
// "3 hours and 22 minutes"
```

### HR system — notice periods

```ts
// Add 30 business days, skipping the correct weekends for the employee's country
const lastDay = Badger(terminationDate).addBusinessDays(30, employeeLocale);

// Count remaining working days
const workingDays = Badger.range(Badger(), lastDay, "day")
    .filter(d => d.isBusinessDay(employeeLocale)).length;

// Display the last working day
Sett(lastDay.toDate(), employeeLocale).formatDateOnly()
// "Monday 27 July 2026"
```

### Calendar UI — month grid

```ts
// Get every day in June 2026
const days = Badger.range(
    Badger("2026-06-01").startOf("month"),
    Badger("2026-06-01").endOf("month").add(1, "day"),
    "day"
);

// Week start and day names vary by country
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
            Sett(new Date()).formatCountdown(new Date(eventDate)) ?? "Event has started!"
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
const opts = {
    timeZone: tz,
    year: "numeric" as const, month: "2-digit" as const,
    day: "2-digit" as const, hour: "2-digit" as const,
    minute: "2-digit" as const, second: "2-digit" as const,
    hour12: false
};

// Get the correct start and end of this week, accounting for clock changes
const weekStart = Sett(new Date(), locale, opts);
const weekEnd   = Sett(Badger().endOf("week").toDate(), locale, opts);

const from = weekStart.formatForBackendToStartOfDay();
const to   = weekEnd.formatForBackendToEndOfDay();

await fetch(`/api/orders?from=${from}&to=${to}`);
```

### Comparing dates across time zones

```ts
// Server returns UTC timestamps — badger-time handles them correctly
const serverDate = Badger("2026-06-15T22:00:00Z");

// A user in Central European Summer Time (UTC+2) sees this as midnight on Jun 16
serverDate.isToday()    // correct for the user's local time zone
serverDate.dayOfWeek    // correct local day of week
serverDate.isWeekend()  // correct local weekend check

// The backend always receives UTC, regardless of the user's time zone
Sett(serverDate.toDate()).formatForBackend()
// "2026-06-15T22:00:00.000Z"
```

---

## Quality

- **817 tests** (8 skipped on Node < 24, where `formatDuration`/`formatCountdown` are unavailable) — every public method, every unit, edge cases including clock change transitions, year boundaries, ISO week rollovers, and locale-specific weekend/week-start logic, plus type-level tests that lock the public type surface
- **100% coverage** — statements, branches, functions, and lines
- **Four time zone suites** — tests run under Europe/Berlin, America/New_York, America/Los_Angeles, and UTC to verify calculations in UTC+ and UTC− zones. New York and Los Angeles cover spring-forward (March) and fall-back (November). Los Angeles also guards the date-only-string path west of UTC, where a mis-anchored parse would drift the calendar day. Kolkata (UTC+5:30, no clock changes) covers the half-hour offset across all months and month-ends
- **Structured audit** — every function was audited for bad inputs, missing inputs, and unexpected values. All findings fixed
- **No runtime dependencies** — the bundle is the entire library

```bash
npm test           # full suite + coverage
npm run test:cet   # Europe/Berlin (CET/CEST) clock change suite
npm run test:ny    # America/New_York (EST/EDT) clock change suite
npm run test:la    # America/Los_Angeles — date-only west-of-UTC guard
```

---

## License

[MIT](LICENSE) © 2026 Luke Price (The Purple Brock).
