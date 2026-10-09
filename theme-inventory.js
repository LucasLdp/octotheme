import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function readThemeDirectories(paths, isTheme) {
    const names = new Map();

    for (const path of new Set(paths)) {
        const dir = Gio.File.new_for_path(path);
        if (!dir.query_exists(null))
            continue;

        let enumerator = null;
        try {
            enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null,
            );

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() !== Gio.FileType.DIRECTORY)
                    continue;

                const name = info.get_name();
                if (!isTheme(dir.get_child(name)))
                    continue;

                const key = name.toLowerCase();
                if (!names.has(key))
                    names.set(key, name);
            }
        } catch (error) {
            console.error(`OctoTheme: erro ao ler ${path}: ${error.message}`);
        } finally {
            if (enumerator) {
                try {
                    enumerator.close(null);
                } catch {
                    enumerator = null;
                }
            }
        }
    }

    return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function isDirectory(dir, name) {
    return dir.get_child(name).query_file_type(
        Gio.FileQueryInfoFlags.NONE, null,
    ) === Gio.FileType.DIRECTORY;
}

function isGtkTheme(dir) {
    return ['gtk-2.0', 'gtk-3.0', 'gtk-4.0'].some(name => isDirectory(dir, name));
}

function isIconTheme(dir) {
    return dir.get_child('index.theme').query_exists(null);
}

function isShellTheme(dir) {
    return dir.get_child('gnome-shell')
        .get_child('gnome-shell.css')
        .query_exists(null);
}

export function readInstalledThemeInventory() {
    const home = GLib.get_home_dir();
    const themesDirs = [
        GLib.build_filenamev([home, '.themes']),
        GLib.build_filenamev([home, '.local', 'share', 'themes']),
        '/usr/local/share/themes',
        '/usr/share/themes',
    ];
    const iconsDirs = [
        GLib.build_filenamev([home, '.icons']),
        GLib.build_filenamev([home, '.local', 'share', 'icons']),
        '/usr/local/share/icons',
        '/usr/share/icons',
    ];

    const gtkNames = readThemeDirectories(themesDirs, isGtkTheme);
    const shellNames = readThemeDirectories(themesDirs, isShellTheme);
    const themeNames = [...new Set([...gtkNames, ...shellNames])]
        .sort((a, b) => a.localeCompare(b));
    const iconNames = readThemeDirectories(iconsDirs, isIconTheme);

    return {gtkNames, shellNames, themeNames, iconNames};
}
