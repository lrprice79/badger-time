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

// Set your app's locale once
BadgerSettings.setLocale(new Intl.Locale("en-US"));

// Date arithmetic — no new keyword
Badger("2026-06-15").add(7, "day").toISOString()
// "2026-06-22T00:00:00.000Z"

// Is a delivery slot today?
Badger(order.deliveryTime).isToday()

// Format for display — picks up the global locale automatically
Sett(order.deliveryTime).formatDate()        // "06/15/2026, 03:30:45 PM"
Sett(order.deliveryTime).formatRelative()    // "in 2 hours"
Sett(order.deliveryTime).formatTimeOnly()    // "03:30:45 PM"  ← 12h for en-US

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
Badger("2026-03-15T10:30:00")     // bare datetime → treated as UTC
Badger("2026-03-15")              // date-only → UTC midnight
Badger("2026-03-15T10:30:00Z")    // explicit timezone → used as-is
Badger(someDate)                  // copy of a Date object
```

**String parsing rules**
- Date-only strings (`"YYYY-MM-DD"`) → UTC midnight (no `Z` appended — Safari compatibility)
- Strings with `Z` or `±HH:MM` → used as-is
- All other bare datetime strings → `Z` appended automatically

### `Badger.fromLocal(date, time)` — local wall-clock

Use when a date+time pair from a form or picker represents **local time**, not UTC.

```ts
const dt = Badger.fromLocal("2026-05-22", "00:15");
dt.hour;      // 0  — local midnight, not shifted to UTC
dt.dayOfWeek; // 5  — Friday, correct local day
```

### `Badger.min()` / `Badger.max()`

```ts
const earliest = Badger.min(deadline, today, cutoff);
const latest   = Badger.max(deadline, today, cutoff);
```

### `Badger.range(start, end, unit)` — date range iterator

Returns an array of `Badger` instances from `start` (inclusive) to `end` (exclusive). Day ranges are normalised to UTC midnight; week and month ranges preserve the input time.

```ts
// Build a calendar month grid
Badger.range("2026-06-01", "2026-07-01", "day")
// → [Jun 1, Jun 2, Jun 3, … Jun 30]  — 30 Badger instances at midnight UTC

// Weekly report headers
Badger.range(startOfQuarter, endOfQuarter, "week")

// Monthly chart labels
Badger.range("2026-01-01", "2027-01-01", "month")
// → [Jan 1, Feb 1, Mar 1, … Dec 1]

// Accepts strings, Dates, or Badger instances
Badger.range(new Date("2026-06-01"), new Date("2026-06-08"), "day")
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
dt.dayOfWeek   // 6        (0 = Sunday … 6 = Saturday)
dt.dayOfYear   // 185      (1–366)
dt.weekYear    // 2026     (ISO week-year)
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

---

### Business days

Locale-aware — uses `Intl.Locale` `weekInfo` to determine the weekend for any locale. Saudi Arabia skips Friday+Saturday, not Saturday+Sunday.

```ts
// Default — uses Saturday+Sunday as weekend
Badger("2026-06-12").isBusinessDay()                                // true  (Friday en-GB)
Badger("2026-06-13").isBusinessDay()                                // false (Saturday)

// Locale-aware
Badger("2026-06-12").isBusinessDay(new Intl.Locale("ar-SA"))        // false (Friday is weekend in ar-SA)
Badger("2026-06-14").isBusinessDay(new Intl.Locale("ar-SA"))        // true  (Sunday is a workday in ar-SA)

// Add/subtract business days — skips the correct weekend for the locale
Badger("2026-06-12").addBusinessDays(1)                             // Mon Jun 15 (skips Sat+Sun)
Badger("2026-06-12").addBusinessDays(1, new Intl.Locale("ar-SA"))   // Sun Jun 14 (skips Fri+Sat)
Badger("2026-06-15").subtractBusinessDays(1)                        // Fri Jun 12
```

No other date library does this natively.

---

### Countdown

Returns `{ days, hours, minutes, seconds }` until a future date, or `null` if the date has passed. `null` makes the expired state explicit — TypeScript enforces you handle it.

```ts
Badger("2026-12-25").countdown()
// { days: 193, hours: 4, minutes: 22, seconds: 11 }

Badger("2026-01-01").countdown()
// null — already passed

// Use with Sett.formatCountdown() for a one-liner display string
Sett(new Date()).formatCountdown(Badger("2026-12-25"))
// "193 days, 4 hours, 22 minutes, and 11 seconds"  (Node 24+ / modern browsers)
// null if past
```

---

### Boundaries

```ts
dt.startOf("year")    // 1 Jan, 00:00:00.000
dt.startOf("quarter") // first day of the quarter, midnight
dt.startOf("month")   // first of the month, midnight
dt.startOf("week")    // Monday 00:00:00.000  (ISO 8601)
dt.startOf("day")     // 00:00:00.000
dt.startOf("hour")
dt.startOf("minute")
dt.startOf("second")

dt.endOf("year")      // 31 Dec, 23:59:59.999
dt.endOf("quarter")
dt.endOf("month")     // last day, 23:59:59.999
dt.endOf("week")      // Sunday 23:59:59.999
dt.endOf("day")       // 23:59:59.999
dt.endOf("hour")
dt.endOf("minute")
dt.endOf("second")
```

---

### Comparison

```ts
dt.isBefore(other)
dt.isAfter(other)
dt.isSameOrBefore(other)
dt.isSameOrAfter(other)
dt.isSame(other)             // exact
dt.isSame(other, "day")      // same calendar day
dt.isSame(other, "month")    // same month
```

**`isBetween`** — exclusive by default, configurable:

```ts
date.isBetween(open, close)
open.isBetween(open, close, { includeStart: true })
close.isBetween(open, close, { includeEnd: true })
```

**`clamp`** — constrain to a range:

```ts
Badger("2025-01-01").clamp(min, max)  // → min
Badger("2027-01-01").clamp(min, max)  // → max
```

**Convenience helpers:**

```ts
dt.isToday()
dt.isYesterday()
dt.isTomorrow()
dt.isPast()
dt.isFuture()
dt.isWeekend()   // hardcoded Sat+Sun — use Sett.isWeekend() for locale-aware
dt.isWeekday()
```

All comparisons accept `Badger | Date`.

---

### Diff

```ts
a.diff(b, "hour")        // 1    — whole number, floored
a.diff(b, "hour", true)  // 1.5  — fractional
b.diff(a, "minute")      // -90  — negative when b is before a
```

`diff("day")`, `diff("week")`, and `dayOfYear` are **DST-safe** — calendar days, not raw milliseconds.

---

### Other utilities

```ts
dt.set("year", 2030)          // returns new Badger with field replaced
dt.toISOString()              // "2026-03-15T10:30:00.000Z"
dt.toDate()                   // copy of underlying Date
dt.toUnixTimestamp()          // Unix seconds (floored)
dt.toMillisecondTimestamp()   // Unix milliseconds
dt.toObject()                 // { year, month, day, hour, minute, second, millisecond }
dt.clone()
dt.isValid()
dt.getDaysInMonth()           // 28–31
dt.daysInYear()               // 365 or 366
dt.getWeekNumber()            // ISO 8601 week number (1–53)
dt.isLeapYear()
```

---

## Sett — locale-aware formatting

Defaults to `en-GB` / `Europe/London` unless overridden by `BadgerSettings`.

### Construction

```ts
Sett()                                              // now, global defaults
Sett(someDate)
Sett(someDate, new Intl.Locale("sv-SE"))
Sett(someDate, new Intl.Locale("sv-SE"), {          // full control
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
s.getDayName()           // "Sunday"     (also: "short" | "narrow")
s.getMonthName()         // "March"      (also: "short" | "narrow")
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
// 12-hour format for ar-SA
```

### Locale-aware calendar

`isWeekend()` and `startOfWeek()` use `Intl.Locale.weekInfo` — correct for every locale worldwide.

```ts
// Saudi Arabia: Friday+Saturday are the weekend
Sett(new Date("2026-06-05"), new Intl.Locale("ar-SA")).isWeekend()  // true  (Friday)
Sett(new Date("2026-06-07"), new Intl.Locale("ar-SA")).isWeekend()  // false (Sunday is a workday)

// Week start varies by locale
Sett(new Date("2026-06-10"), new Intl.Locale("en-US")).startOfWeek()
// → 2026-06-07T00:00:00.000Z  (Sunday — en-US)

Sett(new Date("2026-06-10"), new Intl.Locale("en-GB")).startOfWeek()
// → 2026-06-08T00:00:00.000Z  (Monday — en-GB)
```

### Relative time

```ts
s.formatRelative()             // "3 hours ago" / "in 2 days"
s.formatRelative(anchorDate)   // relative to a specific date instead of now
```

### Duration formatting

Uses `Intl.DurationFormat` — the platform formats the string, no hand-rolled logic.

> Requires Node ≥ 24, Chrome 127+, Firefox 127+, Safari 17.4+. Throws in older environments.

```ts
Sett(new Date(), new Intl.Locale("en-GB")).formatDuration({ hours: 3, minutes: 22 })
// "3 hours and 22 minutes"

Sett(new Date(), new Intl.Locale("de-DE")).formatDuration({ hours: 2, minutes: 30 })
// "2 Stunden und 30 Minuten"

// Pair with diff() — elapsed time in one line
const minutes = Badger(startTime).diff(Badger(), "minute");
Sett(new Date()).formatDuration({ minutes })
// "47 minutes"
```

### Countdown display

`formatCountdown()` combines `Badger.countdown()` and `formatDuration()` into one call. Returns `null` if the date is in the past.

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

Both start/end of day are **DST-safe** — the correct UTC offset is resolved for that specific calendar date.

---

## BadgerSettings — global defaults

Set once at app startup. Every `Sett()` call without an explicit locale inherits these automatically.

```ts
import { BadgerSettings } from "badger-time";

BadgerSettings.defaultLocale   = new Intl.Locale("sv-SE");
BadgerSettings.defaultTimeZone = "Europe/Stockholm";

// No locale arg needed anywhere in the app
Sett(order.deliveryTime).formatDate()      // sv-SE / Stockholm
Sett(order.deliveryTime).isWeekend()       // uses sv-SE weekInfo
Sett(order.deliveryTime).formatTimeOnly()  // 24h (sv-SE is 24-hour)

// Explicit locale always wins
Sett(date, new Intl.Locale("fr-FR")).formatDate()  // → fr-FR
```

### Reactive language switching

`setLocale()` updates the global **and** notifies all subscribers. One call, entire app updates.

```ts
const unsub = BadgerSettings.subscribe(locale => {
    console.log("Switched to", locale.baseName);
});

BadgerSettings.setLocale(new Intl.Locale("fr-FR"));
// → "Switched to fr-FR"

unsub(); // stop listening
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

Clears locale, timezone, and all subscribers. Useful in tests.

```ts
BadgerSettings.reset();
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
// "3 hours and 22 minutes"
```

### HR system — notice periods

```ts
const lastDay = Badger(terminationDate).addBusinessDays(30, employeeLocale);
// Correctly skips weekends for the employee's country

const working = Badger.range(today, lastDay, "day")
    .filter(d => Sett(d.toDate(), employeeLocale).isBusinessDay());

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

### Backend query — date range

```ts
const sett = Sett(Badger().toDate(), new Intl.Locale("en-GB"), { timeZone: "Europe/London" });

// This week's orders — DST-safe boundaries
const from = sett.formatForBackendToStartOfDay();  // Mon 00:00:00 London → UTC
const to   = Sett(Badger().endOf("week").toDate()).formatForBackendToEndOfDay();
```

---

## License

UNLICENSED — private package.
