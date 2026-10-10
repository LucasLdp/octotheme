import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {LANGUAGES, createTranslator} from './i18n.js';
import {
    ACCENT_ORDER,
    canAutoApply,
    groupThemeNames,
    isStandardAccent,
    partitionFamilies,
} from './theme-catalog.js';
import {readInstalledThemeInventory} from './theme-inventory.js';

let GdkPixbuf = null;
try {
    GdkPixbuf = (await import('gi://GdkPixbuf')).default;
} catch {
    GdkPixbuf = null;
}

const COLORS = [
    ['blue', '#3584e4'],
    ['teal', '#2190a4'],
    ['green', '#3a944a'],
    ['yellow', '#c88800'],
    ['orange', '#ed5b00'],
    ['red', '#e62d42'],
    ['pink', '#d56199'],
    ['purple', '#9141ac'],
    ['slate', '#6f8396'],
];

function accentLabel(t, accent) {
    const label = t(`color.${accent}`);
    return isStandardAccent(accent) && label.toLowerCase() !== accent
        ? `${label} (${accent.toUpperCase()})`
        : label;
}

function describeVariant(t, candidate) {
    return [
        t(`variant.${candidate.variant}`),
        candidate.accent ? accentLabel(t, candidate.accent) : null,
        candidate.extras.length > 0 ? candidate.extras.join(' ') : null,
    ].filter(Boolean).join(' · ');
}

function summarizeFamily(t, group) {
    const variants = [...new Set(group.candidates.map(item => describeVariant(t, item)))];
    const summary = t(variants.length === 1 ? 'summary.one' : 'summary.many', {
        count: variants.length,
        list: variants.join(', '),
    });
    return group.requiresManualReview ? summary + t('summary.review') : summary;
}

function buildIconOptions(t, groups) {
    return groups.flatMap(group => group.candidates.map(candidate => {
        const parts = [group.label];
        if (candidate.variant !== 'default')
            parts.push(t(`variant.${candidate.variant}`));
        if (candidate.accent)
            parts.push(accentLabel(t, candidate.accent));
        parts.push(candidate.name);
        if (candidate.ambiguous)
            parts.push(t('choice.ambiguous'));

        return {value: candidate.name, label: parts.join(' · ')};
    }));
}

function createThemeDropdown(t, options, current, onChange) {
    const entries = [{value: '', label: t('choice.auto')}, ...options];
    if (current && !entries.some(entry => entry.value === current)) {
        entries.push({
            value: current,
            label: t('choice.saved', {name: current}),
        });
    }

    const dropdown = new Gtk.DropDown({
        model: Gtk.StringList.new(entries.map(entry => entry.label)),
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    const selected = entries.findIndex(entry => entry.value === current);
    dropdown.set_selected(selected >= 0 ? selected : 0);
    dropdown.connect('notify::selected', () => {
        const index = dropdown.get_selected();
        if (index < entries.length)
            onChange(entries[index].value);
    });

    return dropdown;
}

function readMappings(settings) {
    try {
        const parsed = JSON.parse(settings.get_string('mappings'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    } catch {
        return {};
    }
}

function createSettingRow(title, subtitle, control) {
    const row = new Adw.ActionRow({title, subtitle});
    control.valign = Gtk.Align.CENTER;
    row.add_suffix(control);
    return row;
}

function accentSortValue(accent) {
    if (accent === '')
        return 1000;
    const index = ACCENT_ORDER.indexOf(accent);
    return index >= 0 ? index : 500;
}

function buildAppearancePage(context) {
    const {settings, interfaceSettings, backgroundSettings, connect, t, logoFile} = context;

    const page = new Adw.PreferencesPage({
        title: 'OctoTheme',
        icon_name: 'preferences-desktop-appearance-symbolic',
    });

    const generalGroup = new Adw.PreferencesGroup({
        title: t('general.title'),
        description: t('general.description'),
    });
    page.add(generalGroup);

    const brandRow = new Adw.ActionRow({
        title: 'OctoTheme',
        subtitle: t('brand.subtitle'),
    });
    const logo = new Gtk.Picture({
        width_request: 56,
        height_request: 56,
        can_shrink: true,
        content_fit: Gtk.ContentFit.CONTAIN,
    });
    if (logoFile.query_exists(null))
        logo.set_file(logoFile);
    brandRow.add_prefix(logo);
    generalGroup.add(brandRow);

    const enabledRow = new Adw.SwitchRow({
        title: t('enabled.title'),
        subtitle: t('enabled.subtitle'),
    });
    settings.bind('enabled', enabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    generalGroup.add(enabledRow);

    const wallpaperColorRow = new Adw.SwitchRow({
        title: t('wallpaper.title'),
        subtitle: t('wallpaper.subtitle'),
    });
    settings.bind('use-wallpaper', wallpaperColorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    generalGroup.add(wallpaperColorRow);

    const nativeAccent = interfaceSettings.settings_schema.has_key('accent-color');
    const accentDropdown = new Gtk.DropDown({
        model: Gtk.StringList.new(COLORS.map(([id]) => accentLabel(t, id))),
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    const readAccent = () => nativeAccent
        ? interfaceSettings.get_string('accent-color')
        : settings.get_string('manual-color');
    const syncAccent = () => {
        const index = COLORS.findIndex(([id]) => id === readAccent());
        if (index >= 0 && accentDropdown.get_selected() !== index)
            accentDropdown.set_selected(index);
    };
    syncAccent();
    accentDropdown.connect('notify::selected', () => {
        const index = accentDropdown.get_selected();
        if (index >= COLORS.length)
            return;
        const color = COLORS[index][0];
        if (nativeAccent)
            interfaceSettings.set_string('accent-color', color);
        else
            settings.set_string('manual-color', color);
    });
    connect(interfaceSettings, 'changed::accent-color', syncAccent);
    connect(settings, 'changed::manual-color', syncAccent);
    generalGroup.add(createSettingRow(
        t('accent.title'),
        nativeAccent ? t('accent.native') : t('accent.manual'),
        accentDropdown,
    ));

    const wallpaperGroup = new Adw.PreferencesGroup({
        title: t('preview.title'),
        description: t('preview.description'),
    });
    page.add(wallpaperGroup);

    const previews = [];
    const previewBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        homogeneous: true,
        margin_top: 8,
        margin_bottom: 8,
    });

    for (const appearance of [
        {key: 'light', title: t('preview.light')},
        {key: 'dark', title: t('preview.dark')},
    ]) {
        const card = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            css_classes: ['card'],
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8,
        });
        const title = new Gtk.Label({
            label: appearance.title,
            xalign: 0,
            margin_top: 8,
            margin_start: 8,
        });
        const picture = new Gtk.Picture({
            width_request: 300,
            height_request: 150,
            can_shrink: true,
            content_fit: Gtk.ContentFit.COVER,
        });
        const status = new Gtk.Label({
            label: t('preview.none'),
            xalign: 0,
            wrap: true,
            margin_start: 8,
            margin_end: 8,
            margin_bottom: 8,
            css_classes: ['dim-label'],
        });
        card.append(title);
        card.append(picture);
        card.append(status);
        previewBox.append(card);
        previews.push({key: appearance.key, picture, status});
    }

    wallpaperGroup.add(previewBox);

    const updatePreviews = () => {
        const lightUri = backgroundSettings.get_string('picture-uri');
        const darkUri = backgroundSettings.get_string('picture-uri-dark') || lightUri;
        const uris = {light: lightUri, dark: darkUri};

        for (const preview of previews) {
            preview.picture.set_paintable(null);
            const uri = uris[preview.key];
            if (!uri) {
                preview.status.set_text(t('preview.none'));
                continue;
            }
            if (!GdkPixbuf) {
                preview.status.set_text(t('preview.noPixbuf'));
                continue;
            }

            try {
                const path = Gio.File.new_for_uri(uri).get_path();
                if (!path || !GLib.file_test(path, GLib.FileTest.IS_REGULAR)) {
                    preview.status.set_text(t('preview.unavailable'));
                    continue;
                }

                const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 320, 180, true);
                preview.picture.set_paintable(Gdk.Texture.new_for_pixbuf(pixbuf));
                preview.status.set_text(t('preview.reduced'));
            } catch {
                preview.status.set_text(t('preview.error'));
            }
        }
    };
    updatePreviews();
    connect(backgroundSettings, 'changed::picture-uri', updatePreviews);
    connect(backgroundSettings, 'changed::picture-uri-dark', updatePreviews);

    const applyCustomWallpapers = () => {
        if (!settings.get_boolean('apply-wallpapers'))
            return;
        const light = settings.get_string('wallpaper-light');
        const dark = settings.get_string('wallpaper-dark');
        try {
            if (light)
                backgroundSettings.set_string('picture-uri', light);
            if (dark && backgroundSettings.settings_schema.has_key('picture-uri-dark'))
                backgroundSettings.set_string('picture-uri-dark', dark);
        } catch {
            // Silencioso: a extensão registra o erro no Shell.
        }
        updatePreviews();
    };

    const basenameOf = uri => {
        try {
            const path = Gio.File.new_for_uri(uri).get_path();
            return path ? GLib.path_get_basename(path) : uri;
        } catch {
            return uri;
        }
    };

    const wallpaperRows = [];
    const updateWallpaperRows = () => {
        for (const entry of wallpaperRows) {
            const uri = settings.get_string(entry.key);
            entry.subtitle.set_text(uri ? basenameOf(uri) : t('wallpaper.none'));
            entry.clearButton.set_sensitive(Boolean(uri));
        }
    };

    const chooseWallpaper = (parent, key, subtitle, clearButton) => {
        const dialog = new Gtk.FileChooserNative({
            title: t('wallpaper.choose'),
            action: Gtk.FileChooserAction.OPEN,
            modal: true,
            transient_for: parent,
        });
        const filter = new Gtk.FileFilter({name: t('wallpaper.images')});
        for (const pattern of ['*.png', '*.jpg', '*.jpeg', '*.webp', '*.bmp', '*.svg'])
            filter.add_pattern(pattern);
        dialog.add_filter(filter);
        dialog.connect('response', (self, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = self.get_file();
                if (file) {
                    settings.set_string(key, file.get_uri());
                    subtitle.set_text(basenameOf(file.get_uri()));
                    clearButton.set_sensitive(true);
                    applyCustomWallpapers();
                }
            }
        });
        dialog.show();
    };

    const customGroup = new Adw.PreferencesGroup({
        title: t('wallpaper.custom.title'),
        description: t('wallpaper.custom.description'),
    });
    page.add(customGroup);

    const applyWallpapersRow = new Adw.SwitchRow({
        title: t('wallpaper.apply.title'),
        subtitle: t('wallpaper.apply.subtitle'),
    });
    settings.bind('apply-wallpapers', applyWallpapersRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    customGroup.add(applyWallpapersRow);
    connect(settings, 'changed::apply-wallpapers', applyCustomWallpapers);

    const findPrefsParent = widget => {
        let parent = widget.get_root?.();
        return parent instanceof Gtk.Window ? parent : null;
    };

    for (const key of ['wallpaper-light', 'wallpaper-dark']) {
        const isLight = key === 'wallpaper-light';
        const row = new Adw.ActionRow({
            title: isLight ? t('wallpaper.light.title') : t('wallpaper.dark.title'),
            subtitle: t('wallpaper.none'),
        });
        const box = new Gtk.Box({spacing: 6});
        const chooseButton = new Gtk.Button({label: t('wallpaper.choose'), valign: Gtk.Align.CENTER});
        const clearButton = new Gtk.Button({label: t('wallpaper.clear'), valign: Gtk.Align.CENTER});
        box.append(chooseButton);
        box.append(clearButton);
        row.add_suffix(box);
        customGroup.add(row);
        const setSubtitle = text => row.set_subtitle(text);
        wallpaperRows.push({key, subtitle: {set_text: setSubtitle}, clearButton});
        chooseButton.connect('clicked', () => {
            chooseWallpaper(findPrefsParent(chooseButton), key, {set_text: setSubtitle}, clearButton);
        });
        clearButton.connect('clicked', () => {
            settings.set_string(key, '');
            setSubtitle(t('wallpaper.none'));
            clearButton.set_sensitive(false);
        });
    }

    const applyNowButton = new Gtk.Button({label: t('wallpaper.applyNow'), valign: Gtk.Align.CENTER});
    customGroup.add(createSettingRow(
        t('wallpaper.applyNow.title'),
        t('wallpaper.applyNow.subtitle'),
        applyNowButton,
    ));
    applyNowButton.connect('clicked', applyCustomWallpapers);
    updateWallpaperRows();
    connect(settings, 'changed::wallpaper-light', updateWallpaperRows);
    connect(settings, 'changed::wallpaper-dark', updateWallpaperRows);

    const buildCatalog = inventory => {
        const themeGroups = groupThemeNames(inventory.themeNames);
        const iconGroups = groupThemeNames(inventory.iconNames);
        return {
            inventory,
            themeGroups,
            iconGroups,
            themeLayout: partitionFamilies(themeGroups, 'theme'),
            iconLayout: partitionFamilies(iconGroups, 'icon'),
        };
    };
    let catalog = buildCatalog(readInstalledThemeInventory());

    const automaticGroup = new Adw.PreferencesGroup({
        title: t('auto.title'),
        description: t('auto.description'),
    });
    page.add(automaticGroup);

    const themeFamilyGroup = new Adw.PreferencesGroup({
        title: t('themes.title'),
        description: t('themes.description'),
    });
    page.add(themeFamilyGroup);

    const iconFamilyGroup = new Adw.PreferencesGroup({
        title: t('icons.title'),
        description: t('icons.description'),
    });
    page.add(iconFamilyGroup);

    const activeThemeFamily = new Gtk.Label({
        xalign: 0,
        wrap: true,
        css_classes: ['dim-label'],
    });
    automaticGroup.add(createSettingRow(
        t('active.theme.title'),
        t('active.theme.subtitle'),
        activeThemeFamily,
    ));

    const activeIconFamily = new Gtk.Label({
        xalign: 0,
        wrap: true,
        css_classes: ['dim-label'],
    });
    automaticGroup.add(createSettingRow(
        t('active.icon.title'),
        t('active.icon.subtitle'),
        activeIconFamily,
    ));

    const inventoryLabel = new Gtk.Label({
        xalign: 0,
        wrap: true,
        margin_top: 4,
        margin_bottom: 8,
        css_classes: ['dim-label'],
    });
    const updateInventoryLabel = () => {
        const allGroups = [...catalog.themeGroups, ...catalog.iconGroups];
        inventoryLabel.set_text(t('inventory.text', {
            themes: catalog.inventory.themeNames.length,
            themeFamilies: catalog.themeGroups.length,
            icons: catalog.inventory.iconNames.length,
            iconFamilies: catalog.iconGroups.length,
            ambiguous: allGroups.reduce((total, group) => total + group.ambiguousCount, 0),
        }));
    };
    updateInventoryLabel();
    automaticGroup.add(inventoryLabel);

    const refreshButton = new Gtk.Button({
        label: t('refresh.button'),
        valign: Gtk.Align.CENTER,
    });
    automaticGroup.add(createSettingRow(
        t('refresh.title'),
        t('refresh.subtitle'),
        refreshButton,
    ));

    const mappingGroup = new Adw.PreferencesGroup({
        title: t('mapping.title'),
        description: t('mapping.description'),
    });
    page.add(mappingGroup);

    const modeDropdown = new Gtk.DropDown({
        model: Gtk.StringList.new([t('mode.shared'), t('mode.perMode')]),
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    modeDropdown.set_selected(settings.get_string('theme-mode') === 'per-mode' ? 1 : 0);
    mappingGroup.add(createSettingRow(t('mode.title'), t('mode.subtitle'), modeDropdown));

    const mappingRows = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 4,
    });
    mappingGroup.add(mappingRows);
    const mappings = readMappings(settings);

    const saveMapping = (color, appearance, key, value) => {
        const entry = {...(mappings[color] ?? {})};
        if (appearance === 'shared')
            entry[key] = value;
        else
            entry[appearance] = {...(entry[appearance] ?? {}), [key]: value};
        mappings[color] = entry;
        settings.set_string('mappings', JSON.stringify(mappings));
    };

    const updateActiveFamilies = () => {
        const describe = (key, groups) => {
            if (!key)
                return t('active.none');
            const group = groups.find(item => item.key === key);
            return t('active.using', {name: group?.label ?? key});
        };
        activeThemeFamily.set_text(
            describe(settings.get_string('auto-theme-family'), catalog.themeGroups),
        );
        activeIconFamily.set_text(
            describe(settings.get_string('auto-icon-family'), catalog.iconGroups),
        );
    };

    const familyRows = new Map();

    const clearFamilyRows = group => {
        for (const row of familyRows.get(group) ?? [])
            group.remove(row);
        familyRows.set(group, []);
    };

    const addFamilyRow = (group, row) => {
        group.add(row);
        if (!familyRows.has(group))
            familyRows.set(group, []);
        familyRows.get(group).push(row);
    };

    const renderFamilyBrowser = (container, layout, settingKey, kind) => {
        clearFamilyRows(container);

        if (layout.main.length === 0 && layout.others.length === 0) {
            addFamilyRow(container, new Adw.ActionRow({title: t('browser.empty')}));
            return;
        }

        const applyButtons = [];

        const updateApplyButtons = () => {
            const selectedKey = settings.get_string(settingKey);
            for (const {key, button} of applyButtons) {
                const selected = key === selectedKey;
                button.set_label(selected ? t('family.inUse') : t('family.use'));
                button.set_sensitive(!selected);
            }
        };

        const renderGroups = (target, list) => {
            for (const group of list) {
                const familyRow = new Adw.ExpanderRow({
                    title: group.candidates.some(candidate =>
                        candidate.accent !== null || candidate.variant !== 'default')
                        ? t('family.title', {name: group.label})
                        : group.label,
                    subtitle: summarizeFamily(t, group),
                });

                if (canAutoApply(group, kind)) {
                    const applyFamilyButton = new Gtk.Button({
                        label: t('family.use'),
                        valign: Gtk.Align.CENTER,
                    });
                    applyButtons.push({key: group.key, button: applyFamilyButton});
                    familyRow.add_suffix(applyFamilyButton);
                    applyFamilyButton.connect('clicked', () => {
                        settings.set_string(settingKey, group.key);
                        updateActiveFamilies();
                        updateApplyButtons();
                    });
                }

                const byAccent = new Map();
                for (const candidate of group.candidates) {
                    const category = candidate.accent ?? '';
                    if (!byAccent.has(category))
                        byAccent.set(category, []);
                    byAccent.get(category).push(candidate);
                }

                const accents = [...byAccent.keys()].sort((a, b) =>
                    accentSortValue(a) - accentSortValue(b) || a.localeCompare(b));

                for (const accent of accents) {
                    const candidates = byAccent.get(accent);
                    const accentRow = new Adw.ExpanderRow({
                        title: accent ? accentLabel(t, accent) : t('accent.base'),
                        subtitle: t('folders', {count: candidates.length}),
                    });

                    for (const candidate of candidates) {
                        const variantTitle = [
                            t(`variant.${candidate.variant}`),
                            ...candidate.extras,
                        ].join(' · ');
                        const variantRow = new Adw.ActionRow({
                            title: variantTitle,
                            subtitle: candidate.name +
                                (candidate.ambiguous ? t('warn.ambiguous') : ''),
                        });

                        if (isStandardAccent(candidate.accent)) {
                            const applyVariantButton = new Gtk.Button({
                                label: t('apply.color'),
                                valign: Gtk.Align.CENTER,
                            });
                            variantRow.add_suffix(applyVariantButton);
                            applyVariantButton.connect('clicked', () => {
                                const appearance =
                                    settings.get_string('theme-mode') === 'per-mode' &&
                                    ['light', 'dark'].includes(candidate.variant)
                                        ? candidate.variant
                                        : 'shared';
                                saveMapping(candidate.accent, appearance, kind, candidate.name);
                                renderMappings();
                            });
                        }

                        accentRow.add_row(variantRow);
                    }

                    familyRow.add_row(accentRow);
                }

                if (target === container)
                    addFamilyRow(container, familyRow);
                else
                    target.add_row(familyRow);
            }
        };

        renderGroups(container, layout.main);

        if (layout.others.length > 0) {
            const othersRow = new Adw.ExpanderRow({
                title: t('others.title'),
                subtitle: t(`others.subtitle.${kind}`, {count: layout.others.length}),
            });
            renderGroups(othersRow, layout.others);
            addFamilyRow(container, othersRow);
        }

        updateApplyButtons();
    };

    const addChoiceRow = (expander, color, appearance, key, title, current) => {
        const choices = key === 'icon'
            ? buildIconOptions(t, catalog.iconGroups)
            : catalog.inventory.themeNames.map(name => ({value: name, label: name}));
        const dropdown = createThemeDropdown(
            t,
            choices,
            current,
            value => saveMapping(color, appearance, key, value),
        );
        expander.add_row(createSettingRow(title, t('choice.subtitle'), dropdown));
    };

    const renderMappings = () => {
        let child = mappingRows.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            mappingRows.remove(child);
            child = next;
        }

        const perMode = settings.get_string('theme-mode') === 'per-mode';

        for (const [color, hex] of COLORS) {
            const entry = mappings[color] ?? {};
            const expander = new Adw.ExpanderRow({
                title: t(`color.${color}`),
                subtitle: perMode ? t('mapping.perMode.subtitle') : t('mapping.shared.subtitle'),
            });
            expander.add_prefix(new Gtk.Label({
                label: `<span foreground="${hex}">●</span>`,
                use_markup: true,
            }));

            if (perMode) {
                for (const appearance of ['light', 'dark']) {
                    const mode = t(`mode.${appearance}`);
                    const selection = entry[appearance] ?? {};
                    addChoiceRow(expander, color, appearance, 'theme',
                        t('choice.themeMode', {mode}), selection.theme ?? '');
                    addChoiceRow(expander, color, appearance, 'icon',
                        t('choice.iconMode', {mode}), selection.icon ?? '');
                }
            } else {
                addChoiceRow(expander, color, 'shared', 'theme',
                    t('choice.theme'), entry.theme ?? '');
                addChoiceRow(expander, color, 'shared', 'icon',
                    t('choice.icon'), entry.icon ?? '');
            }

            mappingRows.append(expander);
        }
    };

    const renderBrowsers = () => {
        renderFamilyBrowser(themeFamilyGroup, catalog.themeLayout, 'auto-theme-family', 'theme');
        renderFamilyBrowser(iconFamilyGroup, catalog.iconLayout, 'auto-icon-family', 'icon');
    };

    modeDropdown.connect('notify::selected', () => {
        const selected = modeDropdown.get_selected();
        if (selected >= 2)
            return;
        settings.set_string('theme-mode', selected === 1 ? 'per-mode' : 'shared');
        renderMappings();
    });

    refreshButton.connect('clicked', () => {
        catalog = buildCatalog(readInstalledThemeInventory());
        updateInventoryLabel();
        updateActiveFamilies();
        renderBrowsers();
        renderMappings();
        settings.set_uint('catalog-revision', (settings.get_uint('catalog-revision') + 1) >>> 0);
    });

    renderMappings();
    updateActiveFamilies();
    renderBrowsers();

    mappingGroup.add(new Gtk.Label({
        label: t('note.libadwaita'),
        xalign: 0,
        wrap: true,
        margin_top: 8,
        css_classes: ['dim-label'],
    }));

    return page;
}

function buildLanguagePage(context) {
    const {settings, t, rebuild} = context;

    const page = new Adw.PreferencesPage({
        title: t('page.language'),
        icon_name: 'preferences-desktop-locale-symbolic',
    });

    const group = new Adw.PreferencesGroup({
        title: t('language.title'),
        description: t('language.description'),
    });
    page.add(group);

    const values = ['auto', ...LANGUAGES];
    const dropdown = new Gtk.DropDown({
        model: Gtk.StringList.new([
            t('language.auto'),
            ...LANGUAGES.map(language => t(`language.${language}`)),
        ]),
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    dropdown.set_selected(Math.max(0, values.indexOf(settings.get_string('language'))));
    dropdown.connect('notify::selected', () => {
        const value = values[dropdown.get_selected()];
        if (value === undefined || value === settings.get_string('language'))
            return;
        settings.set_string('language', value);
        rebuild();
    });

    group.add(createSettingRow(t('language.row'), t('language.subtitle'), dropdown));

    return page;
}

export default class OctoThemePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const interfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });
        const backgroundSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.background',
        });
        const logoFile = this.dir.get_child('media').get_child('octotheme-octopus.png');

        let connections = [];
        let pages = [];
        let rebuildSource = 0;

        const connect = (object, signal, callback) => {
            connections.push([object, object.connect(signal, callback)]);
        };

        const disconnectAll = () => {
            for (const [object, id] of connections)
                object.disconnect(id);
            connections = [];
        };

        const build = visibleIndex => {
            disconnectAll();
            for (const page of pages)
                window.remove(page);

            const context = {
                settings,
                interfaceSettings,
                backgroundSettings,
                connect,
                logoFile,
                t: createTranslator(settings.get_string('language')),
                rebuild: () => {
                    if (rebuildSource)
                        return;
                    rebuildSource = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        rebuildSource = 0;
                        build(1);
                        return GLib.SOURCE_REMOVE;
                    });
                },
            };

            pages = [buildAppearancePage(context), buildLanguagePage(context)];
            for (const page of pages)
                window.add(page);
            window.set_visible_page(pages[visibleIndex]);
        };

        window.set_default_size(780, 860);
        build(0);

        window.connect('close-request', () => {
            if (rebuildSource) {
                GLib.Source.remove(rebuildSource);
                rebuildSource = 0;
            }
            disconnectAll();
            return false;
        });
    }
}
