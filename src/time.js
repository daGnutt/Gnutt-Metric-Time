// Gnutt Metric Time calculations using suncalc
const SunCalc = require('suncalc');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function _utcNoon(year, monthIndex, day) {
  // Use UTC midday to avoid DST issues
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function midpointBetween(a, b) {
  return new Date(a.getTime() + (b.getTime() - a.getTime()) / 2);
}

function getNightMidpointForDay(year, monthIndex, day, lat = 45, lon = 0) {
  const date = _utcNoon(year, monthIndex, day);
  const times = SunCalc.getTimes(date, lat, lon);
  const sunset = times.sunset;
  // sunrise of next day
  const nextDate = new Date(date.getTime() + MS_PER_DAY);
  const nextTimes = SunCalc.getTimes(nextDate, lat, lon);
  const sunriseNext = nextTimes.sunrise;
  if (!sunset || !sunriseNext) return null;
  const midpoint = midpointBetween(sunset, sunriseNext);
  const duration = sunriseNext.getTime() - sunset.getTime();
  return { midpoint, duration, sunset, sunriseNext };
}

function getLongestNightMidpointForGregorianYear(year, lat = 45, lon = 0) {
  let best = null;
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const info = getNightMidpointForDay(year, m, d, lat, lon);
      if (!info) continue;
      if (!best || info.duration > best.duration) best = info;
    }
  }
  return best ? best.midpoint : null;
}

function computeStartOfYear(year0 = new Date().getUTCFullYear(), lat = 45, lon = 0) {
  // As described in README: start of Year N is the midpoint of the longest night
  // of Gregorian year (N-1).
  const searchYear = year0 - 1;
  const midpoint = getLongestNightMidpointForGregorianYear(searchYear, lat, lon);
  return midpoint;
}

function generateNightMidpointsInRange(startDate, endDate, lat = 45, lon = 0) {
  const midpoints = [];
  // iterate days from startDate (UTC date) to endDate
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    const d = new Date(t);
    const info = getNightMidpointForDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), lat, lon);
    if (info && info.midpoint) midpoints.push(info.midpoint);
  }
  // sort
  midpoints.sort((a, b) => a - b);
  return midpoints;
}

function findBracketMidpoints(now, lat = 45, lon = 0) {
  // search around now, expanding window until we find two midpoints that bracket 'now'
  let daysWindow = 3;
  for (let iter = 0; iter < 5; iter++) {
    const start = new Date(now.getTime() - daysWindow * MS_PER_DAY);
    const end = new Date(now.getTime() + daysWindow * MS_PER_DAY);
    const mids = generateNightMidpointsInRange(start, end, lat, lon);
    for (let i = 0; i < mids.length - 1; i++) {
      if (mids[i].getTime() <= now.getTime() && now.getTime() < mids[i + 1].getTime()) {
        return { prev: mids[i], next: mids[i + 1] };
      }
    }
    daysWindow *= 2;
  }
  return null;
}

function formatGMT(parts, precision = 3) {
  const frac = parts.fraction.toFixed(precision).slice(2); // remove "0."
  const paddedDay = String(parts.dayIndex).padStart(3, '0');
  return `${parts.year}:${paddedDay}.${frac}`;
}

function computeGMT(now = new Date(), opts = {}) {
  const lat = opts.lat ?? 45;
  const lon = opts.lon ?? 0;
  const year0 = opts.year0 ?? new Date().getUTCFullYear();
  const precision = opts.precision ?? 3;

  const startOfYear = computeStartOfYear(year0, lat, lon);
  if (!startOfYear) throw new Error('Could not compute start of year midpoint');

  // Ensure we have bracket midpoints for 'now'
  let bracket = findBracketMidpoints(now, lat, lon);
  if (!bracket) throw new Error('Could not bracket current time with night midpoints');

  const prev = bracket.prev;
  const next = bracket.next;
  const fraction = (now.getTime() - prev.getTime()) / (next.getTime() - prev.getTime());

  const daysSinceStart = Math.floor((prev.getTime() - startOfYear.getTime()) / MS_PER_DAY + 0.0000001);
  const year = year0;
  const dayIndex = daysSinceStart >= 0 ? daysSinceStart : ((daysSinceStart % 365) + 365) % 365; // rough fallback

  const formatted = formatGMT({ year, dayIndex, fraction }, precision);
  return {
    year,
    dayIndex,
    fraction,
    formatted,
    startOfYear,
    prevMidpoint: prev,
    nextMidpoint: next,
  };
}

module.exports = { computeGMT, computeStartOfYear };


