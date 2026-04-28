import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function _utcNoon(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function midpointBetween(a, b) {
  return new Date(a.getTime() + (b.getTime() - a.getTime()) / 2);
}

function getNightMidpointForDay(year, monthIndex, day, lat = 45, lon = 0) {
  const date = _utcNoon(year, monthIndex, day);
  const times = globalThis.SunCalc.getTimes(date, lat, lon);
  const sunset = times.sunset;
  const nextDate = new Date(date.getTime() + MS_PER_DAY);
  const nextTimes = globalThis.SunCalc.getTimes(nextDate, lat, lon);
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
  const searchYear = year0 - 1;
  const midpoint = getLongestNightMidpointForGregorianYear(searchYear, lat, lon);
  return midpoint;
}

function generateNightMidpointsInRange(startDate, endDate, lat = 45, lon = 0) {
  const midpoints = [];
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    const d = new Date(t);
    const info = getNightMidpointForDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), lat, lon);
    if (info && info.midpoint) midpoints.push(info.midpoint);
  }
  midpoints.sort((a, b) => a - b);
  return midpoints;
}

function findBracketMidpoints(now, lat = 45, lon = 0) {
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
  const frac = parts.fraction.toFixed(precision).slice(2);
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

  const bracket = findBracketMidpoints(now, lat, lon);
  if (!bracket) throw new Error('Could not bracket current time with night midpoints');

  const prev = bracket.prev;
  const next = bracket.next;
  const fraction = (now.getTime() - prev.getTime()) / (next.getTime() - prev.getTime());

  const daysSinceStart = Math.floor((prev.getTime() - startOfYear.getTime()) / MS_PER_DAY + 0.0000001);
  const year = year0;
  const dayIndex = daysSinceStart >= 0 ? daysSinceStart : ((daysSinceStart % 365) + 365) % 365;

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

export default class GnuttMetricTimeExtension extends Extension {
  enable() {
    this._loadSunCalc();
    this._indicator = new PanelMenu.Button(0.0, 'GnuttMetricTime');
    
    // Create label following GNOME extension pattern
    try {
      this._label = new St.Label({
        text: 'GMT',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'gnutt-metric-time-label'
      });
      // Configure clutter_text for proper rendering
      this._label.clutter_text.set({
        x_align: Clutter.ActorAlign.CENTER,
      });
      this._indicator.add_child(this._label);
    } catch (e) {
      console.log("Label creation failed:", e.message);
    }
    
    Main.panel.addToStatusArea('gnutt-metric-time', this._indicator, 1, 'right');
    this._updateLabel();
    this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
      this._updateLabel();
      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    if (this._timeoutId) {
      GLib.source_remove(this._timeoutId);
      this._timeoutId = 0;
    }
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }

  _loadSunCalc() {
    if (globalThis.SunCalc) return;
    try {
      const suncalcPath = this.path + '/vendor/suncalc.js';
      const file = Gio.File.new_for_path(suncalcPath);
      const [ok, contents] = file.load_contents(null);
      if (ok) {
        const code = new TextDecoder().decode(contents);
        new Function(code)();
      }
    } catch (e) {
      console.error('Failed to load SunCalc:', e);
    }
  }

  _updateLabel() {
    try {
      if (globalThis.SunCalc && this._label) {
        const res = computeGMT(new Date(), {
          year0: new Date().getUTCFullYear(),
          precision: 3
        });
        // Plain text - no markup
        this._label.text = res.formatted;
      }
    } catch (e) {
      console.error('Gnutt update error:', e);
    }
  }
}



