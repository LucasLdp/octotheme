import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {createTranslator} from './i18n.js';
import {
    groupThemeNames,
    resolveThemeFamily,
    resolveThemeSelection,
} from './theme-catalog.js';
import {readInstalledThemeInventory} from './theme-inventory.js';

let GdkPixbuf = null;
try {
    GdkPixbuf = (await import('gi://GdkPixbuf')).default;
} catch (error) {
    console.warn(`[OctoTheme] GdkPixbuf indisponível: ${error.message}`);
}

const ACCENT_HUES = {
    red: 355,
    orange: 25,
    yellow: 41,
    green: 130,
    teal: 188,
    blue: 213,
    purple: 286,
    pink: 331,
};

const hueDistance = (a, b) => {
    const distance = Math.abs(a - b) % 360;
    return Math.min(distance, 360 - distance);
};

function dominantAccent(pixbuf) {
    const width = pixbuf.get_width();
    const height = pixbuf.get_height();
    const channels = pixbuf.get_n_channels();
    const rowstride = pixbuf.get_rowstride();
    const pixels = pixbuf.get_pixels();
    const scores = Object.fromEntries(Object.keys(ACCENT_HUES).map(name => [name, 0]));

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const offset = y * rowstride + x * channels;
            const red = pixels[offset];
            const green = pixels[offset + 1];
            const blue = pixels[offset + 2];
            const maximum = Math.max(red, green, blue);
            const minimum = Math.min(red, green, blue);
            const value = maximum / 255;
            const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;

            if (saturation < 0.25 || value < 0.2)
                continue;

            const delta = maximum - minimum;
            let hue;
            if (maximum === red)
                hue = ((green - blue) / delta) % 6;
            else if (maximum === green)
                hue = (blue - red) / delta + 2;
            else
                hue = (red - green) / delta + 4;
            hue = (hue * 60 + 360) % 360;

            let nearestAccent = null;
            let nearestDistance = Infinity;
            for (const [name, accentHue] of Object.entries(ACCENT_HUES)) {
                const distance = hueDistance(hue, accentHue);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestAccent = name;
                }
            }
            scores[nearestAccent] += saturation * value;
        }
    }

    const [accent, score] = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0];
    return score / (width * height) < 0.03 ? 'slate' : accent;
}

function loadUserThemeSettings() {
    const schemaDir = GLib.build_filenamev([
        GLib.get_home_dir(),
        '.local/share/gnome-shell/extensions/user-theme@gnome-shell-extensions.gcampax.github.com/schemas',
    ]);

    try {
        const source = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir,
            Gio.SettingsSchemaSource.get_default(),
            false,
        );
        const schema = source.lookup('org.gnome.shell.extensions.user-theme', true);
        if (schema?.has_key('name'))
            return new Gio.Settings({settings_schema: schema});
    } catch (error) {
        console.warn(`[OctoTheme] Não foi possível carregar o schema User Themes: ${error.message}`);
    }

    return null;
}

export default class OctoTheme extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._interfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });
        this._backgroundSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.background',
        });
        this._shellSettings = loadUserThemeSettings();
        this._hasNativeAccent =
            this._interfaceSettings.settings_schema.has_key('accent-color');
        this._warnedAboutPixbuf = false;
        this._connections = [];

        const watch = (object, signal, callback) => {
            this._connections.push([object, object.connect(signal, callback)]);
        };

        if (this._shellSettings)
            watch(this._shellSettings, 'changed::name', () => this._apply());

        watch(this._interfaceSettings, 'changed::accent-color', () => this._apply());
        watch(this._interfaceSettings, 'changed::color-scheme', () => {
            this._apply();
            this._syncFromWallpaper();
        });
        watch(this._settings, 'changed::manual-color', () => this._apply());
        watch(this._settings, 'changed::mappings', () => this._apply());
        watch(this._settings, 'changed::theme-mode', () => this._apply());
        watch(this._settings, 'changed::auto-theme-family', () => this._apply());
        watch(this._settings, 'changed::auto-icon-family', () => this._apply());
        watch(this._settings, 'changed::catalog-revision', () => this._apply());
        watch(this._settings, 'changed::enabled', () => this._apply());
        watch(this._settings, 'changed::use-wallpaper', () => this._syncFromWallpaper());
        watch(this._backgroundSettings, 'changed::picture-uri', () => {
            this._syncFromWallpaper();
        });
        watch(this._backgroundSettings, 'changed::picture-uri-dark', () => {
            this._syncFromWallpaper();
        });

        this._syncFromWallpaper();
        this._apply();
    }

    disable() {
        for (const [object, id] of this._connections ?? [])
            object.disconnect(id);

        this._connections = null;
        this._settings = null;
        this._interfaceSettings = null;
        this._backgroundSettings = null;
        this._shellSettings = null;
    }

    _currentColor() {
        return this._hasNativeAccent
            ? this._interfaceSettings.get_string('accent-color')
            : this._settings.get_string('manual-color');
    }

    _setColor(color) {
        if (this._hasNativeAccent) {
            if (this._interfaceSettings.get_string('accent-color') !== color)
                this._interfaceSettings.set_string('accent-color', color);
        } else if (this._settings.get_string('manual-color') !== color) {
            this._settings.set_string('manual-color', color);
        }
    }

    _mappings() {
        try {
            const mappings = JSON.parse(this._settings.get_string('mappings'));
            return mappings && typeof mappings === 'object' && !Array.isArray(mappings)
                ? mappings
                : {};
        } catch {
            return {};
        }
    }

    _apply() {
        if (!this._settings?.get_boolean('enabled'))
            return;

        const mappings = this._mappings();
        const colorScheme = this._interfaceSettings.get_string('color-scheme');
        const color = this._currentColor();
        const selection = resolveThemeSelection(
            mappings[color],
            this._settings.get_string('theme-mode'),
            colorScheme,
        );
        const themeFamily = this._settings.get_string('auto-theme-family');
        const iconFamily = this._settings.get_string('auto-icon-family');
        const inventory = themeFamily || iconFamily || selection?.theme
            ? readInstalledThemeInventory()
            : null;

        const unifiedTheme = themeFamily && inventory
            ? resolveThemeFamily(
                groupThemeNames(inventory.themeNames),
                themeFamily,
                color,
                colorScheme,
                'appearance',
            )
            : selection?.theme || null;

        const gtkTheme = themeFamily
            ? (unifiedTheme && inventory?.gtkNames.includes(unifiedTheme)
                ? unifiedTheme : null)
            : unifiedTheme
                ? (inventory?.gtkNames.includes(unifiedTheme) ? unifiedTheme : null)
                : selection?.gtk || null;

        const shellTheme = themeFamily
            ? (unifiedTheme && inventory?.shellNames.includes(unifiedTheme)
                ? unifiedTheme : null)
            : unifiedTheme
                ? (inventory?.shellNames.includes(unifiedTheme) ? unifiedTheme : null)
                : selection?.shell || null;

        const iconTheme = iconFamily && inventory
            ? resolveThemeFamily(
                groupThemeNames(inventory.iconNames),
                iconFamily,
                color,
                colorScheme,
            )
            : selection?.icon || null;

        if (!gtkTheme && !iconTheme && !shellTheme)
            return;

        if (gtkTheme &&
            this._interfaceSettings.get_string('gtk-theme') !== gtkTheme) {
            this._interfaceSettings.set_string('gtk-theme', gtkTheme);
        }
        if (iconTheme &&
            this._interfaceSettings.get_string('icon-theme') !== iconTheme) {
            this._interfaceSettings.set_string('icon-theme', iconTheme);
        }
        if (shellTheme && this._shellSettings &&
            this._shellSettings.get_string('name') !== shellTheme) {
            this._shellSettings.set_string('name', shellTheme);
        }
    }

    _syncFromWallpaper() {
        if (!this._settings?.get_boolean('use-wallpaper'))
            return;

        if (!GdkPixbuf) {
            if (!this._warnedAboutPixbuf) {
                this._warnedAboutPixbuf = true;
                const t = createTranslator(this._settings.get_string('language'));
                Main.notify('OctoTheme', t('notify.pixbuf'));
            }
            return;
        }

        const isDark =
            this._interfaceSettings.get_string('color-scheme') === 'prefer-dark';
        const uri = this._backgroundSettings.get_string(
            isDark ? 'picture-uri-dark' : 'picture-uri',
        ) || this._backgroundSettings.get_string('picture-uri');
        if (!uri)
            return;

        try {
            const path = Gio.File.new_for_uri(uri).get_path();
            if (!path)
                return;

            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 96, 96, true);
            this._setColor(dominantAccent(pixbuf));
        } catch (error) {
            console.warn(`[OctoTheme] Não foi possível analisar o plano de fundo: ${error.message}`);
        }
    }
}
