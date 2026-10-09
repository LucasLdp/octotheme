const VARIANT_ORDER = ['default', 'light', 'dark', 'white', 'black'];

export const ACCENT_ORDER = [
    'blue',
    'teal',
    'green',
    'yellow',
    'orange',
    'red',
    'pink',
    'purple',
    'slate',
];

export const EXTRA_ACCENTS = [
    'brown',
    'turquoise',
    'magenta',
    'violet',
    'indigo',
    'maroon',
    'olive',
    'sage',
    'viridian',
    'lime',
    'amber',
    'gold',
    'coral',
    'rose',
];

const ACCENT_ALIASES = new Map([
    ['gray', 'slate'],
    ['grey', 'slate'],
    ['cyan', 'turquoise'],
    ['aqua', 'turquoise'],
    ['bark', 'brown'],
]);

const ACCENT_TOKENS = new Set([
    ...ACCENT_ORDER,
    ...EXTRA_ACCENTS,
    ...ACCENT_ALIASES.keys(),
]);

const MODE_TOKENS = new Map([
    ['dark', 'dark'],
    ['darker', 'dark'],
    ['night', 'dark'],
    ['light', 'light'],
    ['lighter', 'light'],
    ['day', 'light'],
    ['white', 'white'],
    ['black', 'black'],
]);

const INTENSITY_TOKENS = new Set(['darker', 'lighter']);

const NAME_QUALIFIERS = new Set([
    'accent',
    'color',
    'colour',
    'gtk',
    'gtk3',
    'gtk4',
    'icon',
    'icons',
    'iconset',
    'pack',
    'set',
    'theme',
    'variant',
    'variants',
]);

export const isStandardAccent = accent => ACCENT_ORDER.includes(accent);

export const isExtraAccent = accent =>
    typeof accent === 'string' && !ACCENT_ORDER.includes(accent);

const canonicalAccent = token => ACCENT_ALIASES.get(token) ?? token;

const isVariantToken = word => MODE_TOKENS.has(word) || ACCENT_TOKENS.has(word);

function tokenize(name) {
    return String(name ?? '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/([a-z0-9])(Darker|Lighter|Dark|Light)(?=$|[\s._+-])/gu, '$1 $2')
        .split(/[\s._+-]+/u)
        .filter(Boolean);
}

function formatLabel(tokens) {
    return tokens
        .map(token => token === token.toUpperCase() || token === token.toLowerCase()
            ? token.charAt(0).toLocaleUpperCase('en-US') +
                token.slice(1).toLocaleLowerCase('en-US')
            : token)
        .join(' ');
}

export function detectThemeVariant(name) {
    const entries = tokenize(name)
        .map(raw => ({raw, word: raw.toLocaleLowerCase('en-US')}))
        .filter((entry, index) => index === 0 || !NAME_QUALIFIERS.has(entry.word));

    if (entries.length === 0) {
        const fallback = String(name ?? '').trim();
        return {
            family: fallback.toLocaleLowerCase('en-US'),
            label: fallback,
            variant: 'default',
            accent: null,
            extras: [],
        };
    }

    const head = [entries[0]];
    let index = 1;
    while (index < entries.length && !isVariantToken(entries[index].word))
        head.push(entries[index++]);

    let variant = 'default';
    let accent = null;
    const extras = [];

    for (; index < entries.length; index++) {
        const {word} = entries[index];
        if (variant === 'default' && MODE_TOKENS.has(word)) {
            variant = MODE_TOKENS.get(word);
            if (INTENSITY_TOKENS.has(word))
                extras.push(word);
        } else if (accent === null && ACCENT_TOKENS.has(word)) {
            accent = canonicalAccent(word);
        } else {
            extras.push(word);
        }
    }

    return {
        family: head.map(entry => entry.word).join(' '),
        label: formatLabel(head.map(entry => entry.raw)),
        variant,
        accent,
        extras,
    };
}

function accentRank(accent) {
    if (accent === null)
        return -1;
    return isStandardAccent(accent)
        ? ACCENT_ORDER.indexOf(accent)
        : ACCENT_ORDER.length + 1;
}

function finalizeGroup(key, label, candidates) {
    const sorted = [...candidates].sort((a, b) =>
        VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant) ||
        accentRank(a.accent) - accentRank(b.accent) ||
        a.extras.length - b.extras.length ||
        a.name.localeCompare(b.name, 'en'));

    const signature = candidate =>
        `${candidate.variant}:${candidate.accent ?? ''}:${candidate.extras.join('+')}`;
    const counts = new Map();
    for (const candidate of sorted)
        counts.set(signature(candidate), (counts.get(signature(candidate)) ?? 0) + 1);

    const ambiguousCount = [...counts.values()].filter(count => count > 1).length;

    return {
        key,
        label,
        candidates: sorted.map(candidate => ({
            ...candidate,
            ambiguous: counts.get(signature(candidate)) > 1,
        })),
        ambiguousCount,
        requiresManualReview: ambiguousCount > 0,
    };
}

export function groupThemeNames(names) {
    const families = new Map();

    for (const item of names ?? []) {
        const name = typeof item === 'string' ? item : item?.name;
        if (typeof name !== 'string' || !name.trim())
            continue;

        const detection = detectThemeVariant(name);
        if (!families.has(detection.family))
            families.set(detection.family, {label: detection.label, candidates: []});

        const family = families.get(detection.family);
        if (!family.candidates.some(candidate => candidate.name === name)) {
            family.candidates.push({
                name,
                variant: detection.variant,
                accent: detection.accent,
                extras: detection.extras,
            });
        }
    }

    return [...families]
        .map(([key, family]) => finalizeGroup(key, family.label, family.candidates))
        .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

export function resolveThemeFamily(
    groups,
    familyKey,
    accent,
    colorScheme,
    preference = 'accent',
) {
    const group = groups?.find(item => item.key === familyKey);
    if (!group)
        return null;

    const appearance = colorScheme === 'prefer-dark' ? 'dark' : 'light';
    const hasAccentVariants = group.candidates.some(
        candidate => candidate.accent !== null,
    );
    const appearanceVariants = appearance === 'dark'
        ? ['dark', 'black']
        : ['light', 'white'];

    let choices;
    if (preference === 'appearance' && hasAccentVariants) {
        choices = appearanceVariants.map(variant => ({variant, accent}));
    } else if (preference === 'appearance') {
        choices = [
            ...appearanceVariants.map(variant => ({variant, accent: null})),
            {variant: 'default', accent: null},
        ];
    } else {
        choices = [
            {variant: appearance, accent},
            {variant: 'default', accent},
            {variant: appearance, accent: null},
            {variant: 'default', accent: null},
        ];
    }

    for (const choice of choices) {
        const matches = group.candidates.filter(candidate =>
            candidate.variant === choice.variant &&
            candidate.accent === choice.accent);
        const plain = matches.filter(candidate => candidate.extras.length === 0);
        const pool = plain.length > 0 ? plain : matches;
        if (pool.length === 1)
            return pool[0].name;
    }

    return null;
}

export function canAutoApply(group, kind) {
    const preference = kind === 'theme' ? 'appearance' : 'accent';
    return ACCENT_ORDER.some(accent =>
        ['default', 'prefer-dark'].some(scheme =>
            resolveThemeFamily([group], group.key, accent, scheme, preference) !== null));
}

export function partitionFamilies(groups, kind) {
    const main = [];
    const others = [];

    for (const group of groups ?? []) {
        const outsideGnome = kind === 'icon'
            ? group.candidates.filter(candidate => isExtraAccent(candidate.accent))
            : [];
        const insideGnome = kind === 'icon'
            ? group.candidates.filter(candidate => !isExtraAccent(candidate.accent))
            : group.candidates;

        const standalone = insideGnome.length > 0 && !insideGnome.some(candidate =>
            candidate.accent !== null || candidate.variant !== 'default');

        const toOthers = standalone ? [...outsideGnome, ...insideGnome] : outsideGnome;
        const toMain = standalone ? [] : insideGnome;

        if (toMain.length > 0)
            main.push(finalizeGroup(group.key, group.label, toMain));
        if (toOthers.length > 0)
            others.push(finalizeGroup(group.key, group.label, toOthers));
    }

    return {main, others};
}

export function resolveThemeSelection(entry, mode, colorScheme) {
    if (!entry || typeof entry !== 'object')
        return null;

    const text = value => typeof value === 'string' ? value : '';
    const shared = {
        theme: text(entry.theme),
        gtk: text(entry.gtk),
        icon: text(entry.icon),
        shell: text(entry.shell),
    };

    const appearance = colorScheme === 'prefer-dark' ? 'dark' : 'light';
    const selected = mode === 'per-mode' && entry[appearance] &&
        typeof entry[appearance] === 'object'
        ? entry[appearance]
        : {};

    const result = {
        theme: text(selected.theme) || shared.theme,
        gtk: text(selected.gtk) || shared.gtk,
        icon: text(selected.icon) || shared.icon,
        shell: text(selected.shell) || shared.shell,
    };

    return result.theme || result.gtk || result.icon || result.shell
        ? result
        : null;
}
