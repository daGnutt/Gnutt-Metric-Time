# Copilot Instructions for Gnutt Metric Time

## Project Overview

Gnutt Metric Time (GMT) is a fictitious time system based on astronomical calculations. The project provides:
1. **Core library** (`src/time.js`): Algorithms for calculating GMT from Gregorian dates using solar position calculations
2. **GNOME Shell extension** (`extension/`): UI component that displays GMT in the GNOME top bar

The time system uses "night midpoints" (midpoint between sunset and sunrise) as the fundamental unit, anchored to the longest night of each year. All calculations use UTC and are referenced to 45°N, 0° longitude (configurable).

## Build, Test, and Lint Commands

### Dependencies
```bash
npm install
```

### Run Full Test Suite
```bash
npm test
```

### Run Single Test
The test file is located at `test/time.spec.js`. To run it directly:
```bash
node test/time.spec.js
```

### Deploy Extension Locally
**Installation folder**: `~/.local/share/gnome-shell/extensions/gnutt-metric-time@gnutt`

```bash
cp -r src extension/* ~/.local/share/gnome-shell/extensions/gnutt-metric-time@gnutt/
cp package.json ~/.local/share/gnome-shell/extensions/gnutt-metric-time@gnutt/
cd ~/.local/share/gnome-shell/extensions/gnutt-metric-time@gnutt
npm install --production
```

### Reload GNOME Shell (without logging out)
After updating the extension, reload GNOME Shell to apply changes using dbus:

```bash
dbus-send --print-reply --session --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:"global.reexec_self()"
```

**Note**: If reloading doesn't work or you're having issues, you can always restart your session or log out and back in.

**Note**: There are currently no linting tools configured in this project.

## Architecture & Key Concepts

### Core Time Calculation (`src/time.js`)

**Key Functions:**
- `computeGMT(now, opts)` - Main function that returns GMT object from a Date. Accepts options for `lat`, `lon`, `year0`, and `precision`.
- `computeStartOfYear(year0, lat, lon)` - Finds the midpoint of the longest night for the given Gregorian year (used as Year 0).
- `getNightMidpointForDay(year, monthIndex, day, lat, lon)` - Computes sunset/sunrise and their midpoint for a specific day.
- `generateNightMidpointsInRange(startDate, endDate, lat, lon)` - Returns sorted array of night midpoints within a range.
- `findBracketMidpoints(now, lat, lon)` - Finds the two consecutive night midpoints that bracket the current moment.
- `formatGMT(parts, precision)` - Formats result as `YYYY:DDD.FFF` (year:dayIndex.fraction).

**Dependencies:**
- `suncalc` - External library for solar position calculations (sunrise/sunset times)

### GNOME Extension (`extension/`)
- `metadata.json` - Extension metadata (UUID, supported GNOME versions)
- `extension.js` - Main extension entry point (loading/unloading logic)
- `prefs.js` - Settings/preferences UI
- `styles.css` - UI styling

### Time Format
```
YYYY:DDD.FFF
 │    │    └─ Fraction of day (e.g., .123 = 12.3% through the day)
 │    └────── Day index (0-based, 0-364/365)
 └─────────── Year number (can be negative for past dates)
```

## Key Conventions

### Parameter Passing
All configurable parameters use an options object pattern:
```javascript
computeGMT(now, { lat: 45, lon: 0, year0: 2026, precision: 3 })
```
- `lat` (default: 45) - Observer latitude
- `lon` (default: 0) - Observer longitude  
- `year0` (default: current Gregorian year) - Year 0 reference
- `precision` (default: 3) - Decimal places in formatted output

### Date Handling
- All internal calculations use **UTC dates** to avoid DST complications
- Dates are constructed with `Date.UTC()` to ensure UTC semantics
- The `_utcNoon` helper provides consistent UTC reference points
- Constants like `MS_PER_DAY` define time units in milliseconds

### Return Objects
- `computeGMT()` returns an object with: `year`, `dayIndex`, `fraction`, `formatted`, `startOfYear`, `prevMidpoint`, `nextMidpoint`
- `getNightMidpointForDay()` returns `{ midpoint, duration, sunset, sunriseNext }` or `null`
- Functions consistently return `null` when astronomical calculations fail (e.g., polar twilight zones)

### Testing
- Tests use Node.js `assert` module for validation
- The test script logs output for debugging and exits with code 0 on success, 2 on failure
- Test functions are async IIFEs (immediately invoked function expressions)

### Error Handling
- Functions throw descriptive errors for critical failures (e.g., "Could not compute start of year midpoint")
- Functions return `null` for graceful degradation in edge cases (missing sunrise/sunset data)
