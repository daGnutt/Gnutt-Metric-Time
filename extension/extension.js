import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
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

function formatTimeInLocale(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getTimeAtFraction(prevMidpoint, nextMidpoint, fraction) {
  const durationMs = nextMidpoint.getTime() - prevMidpoint.getTime();
  const offsetMs = durationMs * fraction;
  return new Date(prevMidpoint.getTime() + offsetMs);
}

export default class GnuttMetricTimeExtension extends Extension {
  enable() {
    this._loadSunCalc();
    this._getSettings();
    this._indicator = new PanelMenu.Button(0.5, 'GnuttMetricTime');
    
    // Create label for the top bar
    try {
      this._label = new St.Label({
        text: 'GMT',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'gnutt-metric-time-label'
      });
      this._label.clutter_text.set({
        x_align: Clutter.ActorAlign.CENTER,
      });
      this._indicator.add_child(this._label);
    } catch (e) {
      console.log("Label creation failed:", e.message);
    }
    
    // Store GMT data for popup
    this._gmtData = null;
    
    // Setup menu items
    this._setupMenu();
    
    Main.panel.addToStatusArea('gnutt-metric-time', this._indicator, 1, 'right');
    this._updateLabel();
    this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
      this._updateLabel();
      return GLib.SOURCE_CONTINUE;
    });
  }

  _setupMenu() {
    // Create a box to hold all the time info
    this._menuBox = new St.BoxLayout({
      vertical: true,
      style_class: 'gnutt-popup-content'
    });

    // Create a custom menu item for the content
    const menuItem = new PopupMenu.PopupBaseMenuItem({
      reactive: false,
      can_focus: false
    });
    menuItem.add_child(this._menuBox);
    this._indicator.menu.addMenuItem(menuItem);
  }

  _updatePopupContent() {
    if (!this._gmtData || !this._menuBox) return;
    
    // Clear existing content
    this._menuBox.destroy_all_children();
    
    const { prevMidpoint, nextMidpoint } = this._gmtData;
    const displayFormat = this._settings ? this._settings.get_string('display-format') : 'fractions';
    
    // Add title
    const title = new St.Label({
      text: 'Gnutt Metric Time - Today',
      style_class: 'gnutt-popup-title',
      x_expand: true
    });
    this._menuBox.add_child(title);
    
    // Add separator
    this._menuBox.add_child(new St.BoxLayout({
      height: 1,
      style_class: 'gnutt-popup-separator',
      x_expand: true
    }));
    
    // Add fraction times based on selected format
    const fractions = [
      { label: '0/6', value: 0/6, decimal: '0.000' },
      { label: '1/6', value: 1/6, decimal: '0.167' },
      { label: '2/6', value: 2/6, decimal: '0.333' },
      { label: '3/6', value: 3/6, decimal: '0.500' },
      { label: '4/6', value: 4/6, decimal: '0.667' },
      { label: '5/6', value: 5/6, decimal: '0.833' },
      { label: '6/6', value: 6/6, decimal: '1.000' }
    ];
    
    for (const { label, value, decimal } of fractions) {
      const time = getTimeAtFraction(prevMidpoint, nextMidpoint, value);
      const displayLabel = displayFormat === 'decimals' ? decimal : label;
      const fractionLabel = new St.Label({
        text: displayLabel + ': ' + formatTimeInLocale(time),
        style_class: 'gnutt-popup-line',
        x_expand: true
      });
      this._menuBox.add_child(fractionLabel);
    }
  }

  disable() {
    if (this._timeoutId) {
      GLib.source_remove(this._timeoutId);
      this._timeoutId = 0;
    }
    if (this._settings) {
      this._settings = null;
    }
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }

  _getSettings() {
    const schema = 'org.gnome.shell.extensions.gnutt-metric-time';
    
    // Try to get settings from default source first
    const source = Gio.SettingsSchemaSource.get_default();
    let gschema = source.lookup(schema, true);
    
    // If not found, try the extension's local schemas directory
    if (!gschema) {
      try {
        const schemaDir = this.path + '/schemas';
        const file = Gio.File.new_for_path(schemaDir);
        const localSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir, source, false);
        gschema = localSource.lookup(schema, false);
      } catch (e) {
        console.warn(`Could not load schema from ${this.path}/schemas:`, e.message);
      }
    }
    
    if (!gschema) {
      console.warn(`Schema ${schema} not found`);
      this._settings = null;
      return;
    }
    
    this._settings = new Gio.Settings({ settings_schema: gschema });
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
        
        // Update popup content
        this._gmtData = res;
        this._updatePopupContent();
      }
    } catch (e) {
      console.error('Gnutt update error:', e);
    }
  }
}



