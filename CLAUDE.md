# badger-time — Developer Reference

Lightweight date engine and formatter. Zero runtime dependencies.
Replaces `moment` and `date-fns` entirely.

---

## Package structure

```
src/
├── Badger.ts       — date engine (arithmetic, comparison, boundaries)
├── BadgerSett.ts   — formatter (Intl-based display + backend serialisation)
└── index.ts        — barrel: exports Badger, BadgerSett, BadgerZone
```

---

## Badger

Lightweight immutable-style date wrapper. All mutation methods return a new instance — the original is never modified.

### Constructor

```ts
new Badger()                          // current time
new Badger("2026-03-15T10:30:00")    // datetime string → treated as UTC (Z appended)
new Badger("2026-03-15")             // date-only string → UTC midnight (no Z — spec-compliant)
new Badger(someDate)                 // copy of a Date object
```

String parsing rules:
- **Date-only strings** (`"YYYY-MM-DD"`) are left as-is — the ECMAScript spec parses them as UTC midnight. Appending `Z` produces `"YYYY-MM-DDZ"` which is invalid in Safari.
- **Strings with a timezone indicator** (`Z` or `±HH:MM`) are used as-is.
- **All other bare datetime strings** (e.g. `"2026-03-15T10:30:00"`) get `"Z"` appended.

### `Badger.fromLocal(date, time)` — local wall-clock factory

Use when you have a `"YYYY-MM-DD"` + `"HH:mm"` pair that represents local time (e.g. a user-selected pickup slot). The standard constructor appends `Z`, shifting midnight-spanning slots by the UTC offset.

```ts
const dt = Badger.fromLocal("2026-05-22", "00:15");
dt.hour;      // 0  (local midnight — not shifted to UTC)
dt.dayOfWeek; // 5  (Friday, correct local day of week)
```

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

### Arithmetic — all return a new `Badger`, never mutate

```ts
dt.add(7, "day")
dt.subtract(1, "month")
dt.startOf("week")   // Monday 00:00:00
dt.endOf("month")    // last day 23:59:59.999
```

Units: `"year" | "month" | "week" | "day" | "hour" | "minute" | "millisecond"`

Month/year addition clamps to the last valid day (e.g. Jan 31 + 1 month → Feb 28/29).

### Comparisons

```ts
dt.isBefore(other)           // strictly before
dt.isAfter(other)            // strictly after
dt.isSame(other, "day")      // same day (optional unit granularity)
dt.isBetween(start, end)     // exclusive both ends
dt.isToday()
dt.isYesterday()
dt.isTomorrow()
dt.isWeekend()               // Saturday or Sunday
dt.isWeekday()               // Monday–Friday
```

`other`, `start`, `end` accept `Badger | Date`.

### Diff

```ts
dt.diff(other, "hour")         // positive when this > other
dt.diff(other, "day")
dt.diff(other, "millisecond")
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

## BadgerSett

Locale-aware formatter built on `Intl.DateTimeFormat`. Defaults to `en-GB` / `Europe/London`.

### Constructor

```ts
new BadgerSett()                                           // now, en-GB, London
new BadgerSett(someDate)
new BadgerSett(someDate, new Intl.Locale("en-GB"))
new BadgerSett(someDate, new Intl.Locale("sv-SE"), opts)  // custom locale + Intl options
```

### Display methods

```ts
bs.formatDate()           // "15/03/2026, 10:30:45"
bs.formatDateOnly()       // "15/03/2026"
bs.formatTimeOnly()       // "10:30:45"
bs.formatRelative()       // "in 2 days" / "3 hours ago"
bs.getDayName()           // "Sunday"  (format: "long" | "short" | "narrow")
bs.getMonthName()         // "March"
bs.getDaysOfTheWeek()     // ["Monday", "Tuesday", …]  (Mon–Sun)
bs.getMonthsOfTheYear()   // ["January", …]
```

### Backend methods (UTC ISO)

```ts
bs.formatForBackend()              // "2026-03-15T10:30:45.000Z"
bs.formatForBackendToStartOfDay()  // midnight in configured timezone → UTC ISO
bs.formatForBackendToEndOfDay()    // 23:59:59.999 in configured timezone → UTC ISO
```

---

## BadgerZone

Enum mapping BCP 47 locale tags to IANA timezone strings.

```ts
BadgerZone["en-GB"]  // "Europe/London"
BadgerZone["sv-SE"]  // "Europe/Stockholm"
BadgerZone["fi-FI"]  // "Europe/Helsinki"
BadgerZone["da-DK"]  // "Europe/Copenhagen"
BadgerZone["de-DE"]  // "Europe/Berlin"
```

Use when constructing a `BadgerSett` for a specific locale:

```ts
new BadgerSett(date, new Intl.Locale("sv-SE"), {
    timeZone: BadgerZone["sv-SE"],
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});
```

---

## Common patterns

```ts
// Is a delivery slot today?
new Badger(order.deliveryTime).isToday();

// Minutes until an order is due
new Badger(order.dueAt).diff(new Badger(), "minute");

// Start of today for a backend query
new BadgerSett(new Badger().toDate()).formatForBackendToStartOfDay();

// Localised opening hours label (Stockholm locale)
new BadgerSett(new Badger(openingHour).toDate(), new Intl.Locale("sv-SE")).formatTimeOnly();
```

---

## Build & publish

```bash
npm run build       # type-check → bundle → obfuscate
npm publish         # runs build first via prepublishOnly
```

Published package contains only `dist/` — obfuscated JS + `.d.ts` declarations. Source `.ts` files are excluded via `.npmignore`.
