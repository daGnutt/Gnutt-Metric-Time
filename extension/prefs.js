import Adw from 'gi://Adw';

export function init() {}

export function fillPreferencesWindow(window) {
  const page = new Adw.PreferencesPage();
  window.add(page);
}
