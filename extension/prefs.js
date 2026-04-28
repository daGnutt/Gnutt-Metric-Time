import Adw from 'gi://Adw';

export default class GnuttMetricTimePreferences {
  constructor(metadata) {
    this._metadata = metadata;
  }
  
  fillPreferencesWindow(window) {
    const page = new Adw.PreferencesPage();
    window.add(page);
  }
}
