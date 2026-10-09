<div align="center">

<img src="media/octotheme-octopus.png" alt="OctoTheme mascot: a colorful octopus holding a color palette and a gear" width="220">

# OctoTheme

**Change GNOME's accent color and let the theme and icons follow.**
One color, one theme, one icon pack. No manual juggling.

![GNOME Shell](https://img.shields.io/badge/GNOME_Shell-45%20→%2050-4a86cf?logo=gnome&logoColor=white)
![Version](https://img.shields.io/badge/version-0.2.0-8e5ab5)
![Languages](https://img.shields.io/badge/languages-pt--BR%20%7C%20en-3a944a)
![Runtime](https://img.shields.io/badge/runtime-GJS%20%2F%20ESM-ed5b00)

**English** · [Português](README.md)

</div>

---

## What it is

Since GNOME 47 the accent color changes only the highlight color, while the rest of your look stays manual. OctoTheme fixes that: you tell it **which GTK theme, GNOME Shell theme and icon set** belong to each color, and the extension applies everything on its own when the color changes.

```
🟢 Green  →   theme X   +   icons Y
🔵 Blue   →   theme Z   +   icons W
```

The active color can come from **GNOME Settings**, a **manual** choice, or the **dominant color of your wallpaper** (optional).

## Highlights

- 🎨 **One color, one full look.** Each of GNOME's 9 colors gets its own theme and icons.
- 🖼️ **Wallpaper color extraction (optional).** Off by default. When on, the extension picks the accent closest to the image and falls back to slate for neutral wallpapers.
- 👀 **Light and dark wallpaper preview** in the preferences, for looks only. It never applies anything.
- 🌗 **Simple by default, light/dark optional.** By default a single theme and a single icon pack apply to any appearance. If you want, set separate light and dark setups.
- 🧩 **Automatic families.** Instead of hunting for folders like `Yaru-dark`, `YARU-DARK` or `Yaru-blue-dark`, you pick the "Yaru" family and the extension finds the right variant for the current color and appearance.
- 🗂️ **"Other" group.** Single packs and colors GNOME doesn't have are kept apart so they don't clutter the main list.
- 🛠️ **Per-color fine tuning.** Exact choices per color override the automatic family whenever you want.
- 🌍 **Português (Brasil) and English**, switchable live in the **Language** tab, or following the system.
- 🪶 **Light, no extra dependencies.** Only GJS and libraries that already ship with GNOME.

## Compatibility

| Item | Support |
| --- | --- |
| GNOME Shell | 45, 46, 47, 48, 49, 50 |
| Native accent color | GNOME 47 or newer (`org.gnome.desktop.interface accent-color`) |
| GNOME 45 and 46 | No native accent: the active color is stored by the extension itself and picked in the preferences |
| GNOME Shell theme | Requires the **User Themes** extension |
| Wallpaper color extraction | Uses GdkPixbuf. If missing, the extension warns you and everything else keeps working |

## Installation

```bash
git clone <repository-url> octotheme
cd octotheme
./install.sh
```

The script needs `glib-compile-schemas`:

| Distro | Package |
| --- | --- |
| Fedora | `sudo dnf install glib2-devel` |
| Debian / Ubuntu | `sudo apt install libglib2.0-bin` |

After installing:

1. **Log out and log back in.** On Wayland, new extensions only show up after a fresh login.
2. Enable it and open the preferences:

```bash
gnome-extensions enable octotheme@lucasldp.com
gnome-extensions prefs  octotheme@lucasldp.com
```

## Usage

1. Open the preferences and keep **Enable automatic switching** on.
2. Under **Theme families** and **Icon families**, open a family and use **Use family** for the automatic pack, or **Apply to color** on a specific variant.
3. Under **Manual settings per color**, open a color to choose its exact theme and icons. This takes priority over the automatic family.
4. Change the color in **Settings → Appearance** (or use **Active color** in the preferences) and watch everything change.
5. Want to follow the wallpaper? Turn on **Use wallpaper color**.
6. Want different setups for light and dark? Switch **Appearance setup** to **Custom**.

## How family detection works

The extension reads the installed folders and never modifies any file:

| Type | Locations |
| --- | --- |
| Themes | `~/.themes`, `~/.local/share/themes`, `/usr/local/share/themes`, `/usr/share/themes` |
| Icons | `~/.icons`, `~/.local/share/icons`, `/usr/local/share/icons`, `/usr/share/icons` |

A folder name is split into parts. The first words form the **family**; the following words are classified as **appearance** (`dark`, `light`, `white`, `black`, `night`, `day`), **color** (`blue`, `green`, `brown`...) or **extra detail** (`compact`, `nord`...).

| Folder | Family | Appearance | Color | Extra |
| --- | --- | --- | --- | --- |
| `Yaru-blue-dark` | Yaru | dark | blue | |
| `YARU-DARK` | Yaru | dark | | |
| `Colloid-Dark-Compact` | Colloid | dark | | compact |
| `Flat-Remix-GTK-Blue-Dark` | Flat Remix | dark | blue | |
| `Reversal-brown` | Reversal | | brown (not in GNOME) | |

Case, hyphens, dots and underscores don't matter. Names that point to the same spot are flagged as **ambiguous** so you can decide.

### When something goes to "Other"

| Type | Goes to "Other" when... | Examples |
| --- | --- | --- |
| **Themes** | it has no color variation **and** no dark/light mode | Dracula, Nordic, Default |
| **Icons** | it is a single pack, with no color or appearance variation | hicolor, Adwaita, Adwaita Legacy |
| **Icons** | the variant uses a color GNOME doesn't have | `Reversal-brown`, `Yaru-sage` |

Families with real variation (Colloid, Marble Shell, Papirus...) stay in the main list. A variant with a non-GNOME color leaves its family and goes to "Other", while the rest of the family stays where it was.

## Stored settings

Everything lives in GSettings (`org.gnome.shell.extensions.octotheme`):

| Key | Description |
| --- | --- |
| `enabled` | Turns automatic switching on and off |
| `use-wallpaper` | Uses the wallpaper's dominant color |
| `manual-color` | Active color when GNOME has no native accent |
| `theme-mode` | `shared` (one look for everything) or `per-mode` (separate light and dark) |
| `auto-theme-family` / `auto-icon-family` | Chosen automatic families |
| `mappings` | JSON with the exact per-color choices |
| `language` | `auto`, `pt-BR` or `en` |

`mappings` example:

```json
{
  "green": {
    "theme": "Marble-shell-green-dark",
    "icon": "Papirus",
    "light": { "icon": "Papirus-Light" },
    "dark":  { "icon": "Papirus-Dark" }
  }
}
```

The `light` and `dark` fields only apply in **Custom** mode, and empty ones fall back to the shared value.

## Project layout

```
octotheme/
├── extension.js        # main logic: applies theme, icons and wallpaper color
├── prefs.js            # preferences window (Appearance and Language tabs)
├── theme-catalog.js    # family grouping, variants and "Other" rules
├── theme-inventory.js  # reads installed theme and icon folders
├── i18n.js             # pt-BR / en translations
├── schemas/            # GSettings schema
├── media/              # mascot
├── metadata.json
├── LICENSE             # GPL-3.0-or-later
└── install.sh
```

## Troubleshooting

**The extension doesn't show up after installing.**
Log out and back in. On Wayland that's the only way a new extension gets discovered.

**Nothing changes when I switch the color.**
Check that a family or a manual choice exists for that color. Colors without a setup are ignored. The Shell theme only changes with the User Themes extension installed.

**An app didn't change theme.**
libadwaita apps ignore the GTK theme and follow only the system accent color.

**A new pack doesn't appear.**
Use **Rescan theme folders** in the preferences.

**See the extension logs:**

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep OctoTheme
```

**Read a setting straight from the terminal:**

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/octotheme@lucasldp.com/schemas \
  get org.gnome.shell.extensions.octotheme mappings
```

## Known limitations

- libadwaita apps don't follow the chosen GTK theme, only the system accent.
- Dynamic wallpapers (`.xml`) are not analyzed for color extraction.
- In colored families, automatic selection requires the exact color and doesn't fall back to a generic variant.

## Roadmap

- [ ] Auto-fill each color with the variant of the same name (for example `-green` for green)
- [ ] Automatic light/dark variant, picking just the family
- [ ] Presets: export and import combinations as JSON
- [ ] Better color extraction (color clustering, ignoring borders and captions)
- [ ] Fixed color per wallpaper
- [ ] Cursor theme and font per color
- [ ] Quick Settings shortcut
- [ ] Time-based scheduling, sunrise and sunset
- [ ] Recolor libadwaita apps via `gtk.css`
- [ ] Publish on extensions.gnome.org

## Contributing

Bugs and ideas are welcome. When reporting a grouping problem, include the output of:

```bash
ls ~/.themes ~/.icons /usr/share/themes /usr/share/icons
```

It shows the real folder names and helps tune the detection.

## License

Distributed under the [GPL-3.0-or-later](LICENSE) license.

---

<div align="center">
Made with 🐙 by <b>Lucas Gomes</b>
</div>
