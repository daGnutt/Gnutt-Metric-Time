import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

export default class GnuttMetricTimePreferences {
  constructor(metadata) {
    this._metadata = metadata;
  }
  
  fillPreferencesWindow(window) {
    const settings = this._getSettings();
    
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
      title: 'Display Settings'
    });
    page.add(group);
    
    if (!settings) {
      const infoRow = new Adw.ActionRow({
        title: 'Schema Error',
        subtitle: 'Extension schemas need to be compiled'
      });
      group.add(infoRow);
      window.add(page);
      return;
    }
    
    // Create dropdown for display format using ActionRow + DropDown
    const formatRow = new Adw.ActionRow({
      title: 'Time Format',
      subtitle: 'Choose how to display times in the popup'
    });
    
    const dropdown = new Gtk.DropDown();
    const model = new Gtk.StringList();
    model.append('Fractions (0/6, 1/6, ...)');
    model.append('Decimals (0.000, 0.167, ...)');
    
    dropdown.set_model(model);
    
    const currentFormat = settings.get_string('display-format');
    dropdown.set_selected(currentFormat === 'decimals' ? 1 : 0);
    
    dropdown.connect('notify::selected', () => {
      const selected = dropdown.get_selected();
      const format = selected === 1 ? 'decimals' : 'fractions';
      settings.set_string('display-format', format);
    });
    
    formatRow.add_suffix(dropdown);
    formatRow.set_activatable_widget(dropdown);
    group.add(formatRow);
    window.add(page);
  }
  
  _getSettings() {
    const schema = 'org.gnome.shell.extensions.gnutt-metric-time';
    
    // Try to get settings from default source first
    const source = Gio.SettingsSchemaSource.get_default();
    let gschema = source.lookup(schema, true);
    
    // If not found, try the extension's local schemas directory
    if (!gschema) {
      try {
        const schemaDir = this._metadata.path + '/schemas';
        const localSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir, source, false);
        gschema = localSource.lookup(schema, false);
      } catch (e) {
        console.warn(`Could not load schema from schemas directory:`, e.message);
      }
    }
    
    if (!gschema) {
      console.warn(`Schema ${schema} not found`);
      return null;
    }
    
    return new Gio.Settings({ settings_schema: gschema });
  }
}
