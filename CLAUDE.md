# badger-time — Developer Reference

Lightweight date engine and formatter. Zero runtime dependencies.
Replaces `moment` and `date-fns` entirely.

- **npm package:** `@purple-brock/time` (org `@purple-brock`; brand/repo name stays `badger-time`)
- **Requires Node.js 20+.** `formatDuration` / `formatCountdown` require Node 24+.

---

## Package structure

```
src/
├── Badger.ts         — date engine (arithmetic, comparison, boundaries, business days, ranges)
├── BadgerSett.ts     — formatter (Intl-based display + backend serialisation)
├── BadgerSettings.ts — global locale/timezone defaults + subscription
└── index.ts          — barrel + Node-version guard
```

---

## Public API — factory functions, no `new`

`index.ts` exposes **factory functions**, not the classes. The classes (`Badger`,
`BadgerSett`) are internal; only their *types* are exported.

```ts
import { Badger, Sett, BadgerSettings } from "@purple-brock/time";
import type { BadgerInstance, BadgerSettInstance } from "@purple-brock/time";

Badger(date?)                      // → BadgerInstance   (shorthand for new Badger(date))
Sett(date?, locale?, options?)     // → BadgerSettInstance (shorthand for new BadgerSett(...))
BadgerSettings                     // static class — global defaults
```

| Export | Kind | What it does |
|---|---|---|
| `Badger(date?)` | factory fn | Date engine: arithmetic, comparison, boundaries, business days, ranges |
| `Sett(date?, locale?, options?)` | factory fn | Formatting: locale-aware display, relative time, countdown, backend ISO |
| `BadgerSettings` | static class | Global locale + timezone defaults, locale-change subscription |
| `BadgerInstance` | type | The value `Badger()` returns |
| `BadgerSettInstance` | type | The value `Sett()` returns |

Every mutation method returns a **new** instance — the original is never modified.

---

## Badger — date engine

### Creating instances

```ts
Badger()                          // current time
Badger("2026-03-15T10:30:00")    // datetime string → treated as UTC (Z appended)
Badger("2026-03-15")             // date-only string → UTC midnight (no Z — spec-compliant)
Badger(someDate)                 // copy of a Date object
```

String parsing rules:
- **Date-only strings** (`"YYYY-MM-DD"`) are left as-is — the ECMAScript spec parses them as UTC midnight. Appending `Z` would produce `"YYYY-MM-DDZ"`, invalid in Safari.
- **Strings with a timezone indicator** (`Z` or `±HH:MM`) are used as-is.
- **All other bare datetime strings** (e.g. `"2026-03-15T10:30:00"`) get `"Z"` appended.

### `Badger.fromLocal(date, time)` — local wall-clock factory (static)

For a `"YYYY-MM-DD"` + `"HH:mm"` pair that represents local time (e.g. a user-selected slot). The standard factory appends `Z`, shifting midnight-spanning slots by the UTC offset; `fromLocal` does not.

```ts
const dt = Badger.fromLocal("2026-05-22", "00:15");
dt.hour;      // 0  (local midnight — not shifted to UTC)
dt.dayOfWeek; // 5  (Friday, correct local day of week)
```

> `fromLocal` is a static on the underlying class, reached via the named import: `import { Badger } from "@purple-brock/time"; Badger.fromLocal(...)`. (The default factory import and the class share the name `Badger`.)

### `Badger.range(start, end, unit)` — date range generator (static)

```ts
Badger.range("2026-03-01", "2026-03-05", "day")   // → BadgerInstance[] (start inclusive, end exclusive)
```

`unit` is `"day" | "week" | "month"`. Accepts `string | Date | Badger` for both ends. Throws `RangeError` on an invalid start/end. For `"day"`, results are snapped to `startOf("day")`.

### Getters

| Getter       | Returns                       |
| ------------ | ----------------------------- |
| `.year`      | Full year (`2026`)            |
| `.month`     | 1-indexed month (`1`–`12`)    |
| `.day`       | Day of month (`1`–`31`)       |
| `.hour`      | Hour (`0`–`23`)               |
| `.minute`    | Minute (`0`–`59`)             |
| `.second`    | Second (`0`–`59`)             |
| `.dayOfWeek` | `0` = Sunday … `6` = Saturday |

### Arithmetic — all return a new `Badger`

```ts
dt.add(7, "day")
dt.add({ days: 2, hours: 3 })          // duration object (singular or plural keys)
dt.subtract(1, "month")
dt.subtract({ weeks: 1 })
dt.set("month", 0)                      // set a single field (not "week"/"quarter")
dt.startOf("week")                      // Monday 00:00:00
dt.endOf("month")                       // last day 23:59:59.999
```

`UnitOfTime`: `"year" | "quarter" | "month" | "week" | "day" | "hour" | "minute" | "second" | "millisecond"`.
Month/year addition clamps to the last valid day (Jan 31 + 1 month → Feb 28/29).

### Comparisons

```ts
dt.isBefore(other)           // strictly before
dt.isAfter(other)            // strictly after
dt.isSame(other, "day")      // same value at optional unit granularity
dt.isBetween(start, end)     // see options below
dt.isToday()
dt.isYesterday()
dt.isTomorrow()
dt.isWeekend()               // locale-aware weekend (see business days)
dt.isWeekday()
```

`other`/`start`/`end` accept `Badger | Date`. `isBetween` supports inclusive-range options (exclusive by default).

### Business days (locale-aware)

```ts
dt.isBusinessDay(locale?)             // not a weekend for that locale
dt.addBusinessDays(n, locale?)        // n must be a non-negative integer
dt.subtractBusinessDays(n, locale?)   // n must be a non-negative integer
```

`locale` defaults to `BadgerSettings.defaultLocale`. Weekend days are derived per-locale (e.g. Fri/Sat in Saudi Arabia), so business-day maths is correct by country.

### Diff

```ts
dt.diff(other, "hour")            // positive when this > other
dt.diff(other, "day", true)       // float = true → fractional (e.g. 1.5)
```

Month and year diff are calendar-based (not ms-based).

### Other

```ts
dt.toISOString()       // "2026-03-15T10:30:00.000Z"
dt.toDate()            // copy of underlying Date
dt.toUnixTimestamp()   // Unix seconds
dt.clone()
dt.isValid()
dt.getDaysInMonth()    // 28–31
dt.getWeekNumber()     // ISO 8601 week (1–53)
dt.isLeapYear()
```

---

## Sett — locale-aware formatter

Built on `Intl.DateTimeFormat`. Falls back to `BadgerSettings` defaults, then `en-GB` / `Europe/London`.

```ts
Sett()                                           // now, default locale/tz
Sett(someDate)
Sett(someDate, new Intl.Locale("sv-SE"))
Sett(someDate, new Intl.Locale("en-US"), opts)   // custom Intl.DateTimeFormatOptions
```

### Display methods

```ts
bs.formatDate()            // "15/03/2026, 10:30:45"
bs.formatDateOnly()        // "15/03/2026"
bs.formatTimeOnly()        // "10:30:45"   (12h/24h chosen by locale)
bs.formatRelative(relativeTo?)   // "in 2 days" / "3 hours ago"
bs.getDayName(format?)     // "Sunday"   (format: "long" | "short" | "narrow")
bs.getMonthName(format?)   // "March"
bs.getDaysOfTheWeek(format?)     // ["Monday", … "Sunday"]
bs.getMonthsOfTheYear(format?)   // ["January", …]
```

### Countdown & duration (Node 24+)

```ts
bs.formatCountdown(target)   // string, or null when target is in the past
bs.formatDuration({ hours: 2, minutes: 30 })   // localised duration string
```

### Backend methods (UTC ISO)

```ts
bs.formatForBackend()              // "2026-03-15T10:30:45.000Z"
bs.formatForBackendToStartOfDay()  // midnight in configured timezone → UTC ISO
bs.formatForBackendToEndOfDay()    // 23:59:59.999 in configured timezone → UTC ISO
```

---

## BadgerSettings — global defaults

Static class. Set once at app startup; `Badger`/`Sett` instances created without an
explicit locale/timezone inherit these.

```ts
BadgerSettings.defaultLocale            // Intl.Locale | undefined
BadgerSettings.defaultTimeZone          // string | undefined  (e.g. "Europe/Stockholm")

BadgerSettings.setLocale(locale)        // sets defaultLocale AND notifies subscribers
const unsub = BadgerSettings.subscribe(locale => rerenderDates())   // → unsubscribe fn
```

Use `setLocale()` (not direct `defaultLocale =`) when you need subscribers notified —
e.g. a language switcher that should re-render all on-screen dates. `subscribe` returns
an unsubscribe function (handy in a React `useEffect` cleanup).

---

## Common patterns

```ts
// One-time app setup
BadgerSettings.setLocale(new Intl.Locale("en-US"));
BadgerSettings.defaultTimeZone = "America/New_York";

// Is a delivery slot today?
Badger(order.deliveryTime).isToday();

// Minutes until an order is due (fractional)
Badger(order.dueAt).diff(Badger(), "minute", true);

// Move a due date 3 business days forward (locale-aware)
Badger(order.createdAt).addBusinessDays(3);

// Every day in a billing period
Badger.range(period.start, period.end, "day");

// Start of today for a backend query
Sett(Badger().toDate()).formatForBackendToStartOfDay();

// Localised opening time (Stockholm locale)
Sett(Badger(openingHour).toDate(), new Intl.Locale("sv-SE")).formatTimeOnly();
```

---

## Build & publish

```bash
npm run build         # type-check → bundle (rollup) → strip .d.ts comments  (un-obfuscated, RN/Hermes-safe)
npm run build:publish # build + obfuscate  (opt-in; see Hermes warning below)
npm publish           # runs `npm run build` via prepublishOnly (un-obfuscated)
```

`npm run build` is **un-obfuscated by default** so the dist runs in React Native /
Hermes (the obfuscator's `selfDefending` + string-array transforms crash Hermes —
they produce a silent blank screen). Obfuscation is opt-in via `build:publish`.

⚠️ **Publish blocker:** `build:publish` (and the obfuscation in `scripts/obfuscate.mjs`)
is NOT yet Hermes-safe. Before shipping an obfuscated build, set `selfDefending: false`,
disable string-array transforms, and **runtime-test on Hermes** — bundling success does
not prove it runs. Until then, publishing ships the working un-obfuscated build.

Published package contains only `dist/` — JS + `.d.ts` declarations; source `.ts` files
are excluded via `.npmignore`. `publishConfig.access` is `public` (required for a scoped
`@purple-brock/*` package). Not yet published.
