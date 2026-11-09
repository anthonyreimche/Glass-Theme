import assert from "node:assert/strict";
import { test } from "node:test";
import { activate } from "../index.js";

const themes = [];
const stylesheets = [];
activate({
  registerTheme: (theme) => themes.push(theme),
  registerStylesheet: (sheet) => stylesheets.push(sheet),
});

/** `#rrggbb` or `rgb(r g b / a)` → { r, g, b, a }. */
const parse = (css) => {
  if (css.startsWith("#")) {
    const n = Number.parseInt(css.slice(1), 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(css);
  assert.ok(m, `unparsed colour ${css}`);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
};

const over = (top, below) => {
  const mix = (k) => top[k] * top.a + below[k] * (1 - top.a);
  return { r: mix("r"), g: mix("g"), b: mix("b"), a: 1 };
};

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// The brightest backdrop a dark theme's material shows: Windows' dark acrylic
// pulls the wallpaper's luminosity almost all the way to its own grey tint, so
// over a white wallpaper it lands near #383838. #505050 leaves a margin.
const BRIGHTEST_BACKDROP = { r: 80, g: 80, b: 80, a: 1 };

const opaque = (c) => ({ ...c, a: 1 });

for (const theme of themes) {
  const v = (key) => parse(theme.vars[key]);

  test(`${theme.name}: on-accent text is legible on the slider fill`, () => {
    const ratio = contrast(v("--color-on-accent"), v("--color-slider-fill"));
    assert.ok(ratio >= 4.5, `on-accent vs slider-fill is ${ratio.toFixed(2)}:1`);
  });

  test(`${theme.name}: on-accent text is legible on the accent`, () => {
    const ratio = contrast(v("--color-on-accent"), v("--color-accent"));
    assert.ok(ratio >= 4.5, `on-accent vs accent is ${ratio.toFixed(2)}:1`);
  });

  test(`${theme.name}: asks for the acrylic window material`, () => {
    assert.equal(theme.window?.material, "acrylic");
  });

  test(`${theme.name}: text and accents are opaque`, () => {
    for (const key of ["text-primary", "text-secondary", "text-muted", "accent", "accent-hover", "slider-fill", "on-accent"]) {
      assert.equal(v(`--color-${key}`).a, 1, `--color-${key} is translucent`);
    }
  });

  test(`${theme.name}: panel text stays legible over the brightest backdrop`, () => {
    const panel = over(v("--color-surface-1"), over(v("--color-surface-0"), BRIGHTEST_BACKDROP));
    const primary = contrast(v("--color-text-primary"), panel);
    const secondary = contrast(v("--color-text-secondary"), panel);
    assert.ok(primary >= 7, `primary on a panel is ${primary.toFixed(2)}:1`);
    assert.ok(secondary >= 4.5, `secondary on a panel is ${secondary.toFixed(2)}:1`);
  });

  test(`${theme.name}: app-background text stays legible over the brightest backdrop`, () => {
    const base = over(v("--color-surface-0"), BRIGHTEST_BACKDROP);
    const ratio = contrast(v("--color-text-primary"), base);
    assert.ok(ratio >= 4.5, `primary on surface-0 is ${ratio.toFixed(2)}:1`);
  });

  test(`${theme.name}: panel text stays legible when the window is opaque`, () => {
    const panel = opaque(v("--color-surface-1"));
    const primary = contrast(v("--color-text-primary"), panel);
    const secondary = contrast(v("--color-text-secondary"), panel);
    assert.ok(primary >= 7, `primary on an opaque panel is ${primary.toFixed(2)}:1`);
    assert.ok(secondary >= 4.5, `secondary on an opaque panel is ${secondary.toFixed(2)}:1`);
  });
}

test("the overlay frost applies only with the material on and this theme active", () => {
  const [sheet] = stylesheets;
  assert.ok(sheet, "registers a stylesheet");
  assert.match(sheet.css, /@container style\(--theme-glass-active: 1\)/);
  const preludes = [...sheet.css.matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((p) => !p.startsWith("@"));
  assert.ok(preludes.length >= 3, "has the popup and floating panel rules");
  for (const selector of preludes.flatMap((p) => p.split(","))) {
    assert.match(selector.trim(), /^html\.sl-material /);
  }
  assert.equal(themes[0].vars["--theme-glass-active"], "1");
});

/** Selector → declarations, for every rule in the sheet. */
const rules = () => {
  const [sheet] = stylesheets;
  const body = sheet.css.slice(sheet.css.indexOf("{") + 1);
  return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
};

/** The SVG filter a rule's backdrop-filter references, decoded; null if none. */
const frostFilter = (body) => {
  const url = /backdrop-filter: url\("data:image\/svg\+xml,([^"#]+)#(\w+)"\);/.exec(body);
  return url ? { svg: decodeURIComponent(url[1]), id: url[2] } : null;
};

test("popups are frosted with a blur of their own", () => {
  const popup = rules().find((r) => r.selector.includes('[role="menu"]'));
  for (const target of ['body > [role="listbox"]', '[role="dialog"]', '[aria-haspopup="true"][aria-expanded="true"] + *']) {
    assert.ok(popup.selector.includes(target), `frosts ${target}`);
  }
  assert.ok(frostFilter(popup.body), "popups carry the frost filter");
});

// Tuned against the Windhawk translucent Start menu: a wider blur, or the
// backdrop's brightness or contrast pulled down, flattened the photos behind
// a popup into dull grey.
test("the frost keeps what lies behind readable as soft colour", () => {
  for (const { selector, body } of rules()) {
    if (!body.includes("backdrop-filter")) continue;
    const frost = frostFilter(body);
    assert.ok(frost, `${selector} blurs with something other than the frost filter`);
    const radius = Number(/stdDeviation='(\d+)'/.exec(frost.svg)[1]);
    assert.ok(radius >= 15 && radius <= 30, `${selector} blurs ${radius}px`);
    assert.doesNotMatch(frost.svg, /feFunc[RGB]|feColorMatrix/, `${selector} flattens the backdrop's tones`);
    const tint = /background-color: rgb\(\d+ \d+ \d+ \/ ([\d.]+)\)/.exec(body);
    assert.ok(tint && Number(tint[1]) <= 0.35, `${selector} tints too heavily`);
  }
});

// In a glass window the gaps between thumbnails are nearly transparent, and
// backdrop-filter paints over the backdrop instead of replacing it: a blur that
// leaves the result partly clear lets the sharp edges underneath show through.
test("the frost blurs an opaque copy of the backdrop, so it covers the panel evenly", () => {
  const popup = rules().find((r) => r.selector.includes('[role="menu"]'));
  const { svg, id } = frostFilter(popup.body);
  assert.match(svg, new RegExp(`<filter id='${id}'`));
  const flood = svg.indexOf("<feFlood");
  const over = svg.indexOf("operator='over'");
  const blur = svg.indexOf("<feGaussianBlur");
  assert.ok(flood !== -1 && over > flood && blur > over, "lays the backdrop over an opaque base, then blurs");
  assert.match(svg, /flood-color='#[0-9a-f]{6}'/, "the base is fully opaque");
  // The blur sees only the backdrop inside the panel and fades out towards its
  // border; without alpha forced back to 1 the sharp backdrop shows there.
  const opaque = svg.indexOf("<feFuncA type='table' tableValues='1 1'/>");
  assert.ok(opaque > blur, "forces the blurred result opaque right up to the panel's edges");
  assert.ok(svg.indexOf("</filter>") > opaque && !svg.slice(opaque).includes("<fe", 10 + "<feFuncA".length),
    "the opaque step is the filter's last");
});

test("nothing outside the popups is blurred", () => {
  for (const { selector, body } of rules()) {
    if (!body.includes("backdrop-filter")) continue;
    assert.doesNotMatch(selector, /:has\(/, `${selector} blurs a popup's surroundings`);
  }
});

test("the photo grid and filmstrip, which are listboxes, stay clear", () => {
  for (const { selector } of rules()) {
    for (const part of selector.split(",")) {
      if (!part.includes('[role="listbox"]')) continue;
      assert.match(part.trim(), /body > \[role="listbox"\]$/, `${part.trim()} reaches the photo grid`);
    }
  }
});

test("a popup reads as one sheet: base surfaces clear, raised ones light veils, dividers faded", () => {
  for (const selector of ['[role="menu"]', "html.sl-material .sl-floating-panel"]) {
    const rule = rules().find((r) => r.selector.includes(selector) && !r.selector.endsWith("::before"));
    assert.match(rule.body, /--color-surface-0: transparent;/);
    assert.match(rule.body, /--color-surface-1: transparent;/);
    for (const n of [2, 3, 4]) {
      assert.match(rule.body, new RegExp(`--color-surface-${n}: rgb\\(255 255 255 / 0\\.\\d+\\);`));
    }
    assert.match(rule.body, /--color-border-subtle: transparent;/);
    const border = /--color-border: rgb\(255 255 255 \/ ([\d.]+)\);/.exec(rule.body);
    assert.ok(border && Number(border[1]) <= 0.08, "dividers inside a popup stay faint");
  }
});

test("a floating panel is frosted on a layer, not on itself", () => {
  const panel = rules().find((r) => r.selector === "html.sl-material .sl-floating-panel");
  const layer = rules().find((r) => r.selector === "html.sl-material .sl-floating-panel::before");
  assert.doesNotMatch(panel.body, /backdrop-filter/);
  assert.ok(frostFilter(layer.body), "the layer carries the frost filter");
  assert.match(layer.body, /z-index: -1/);
});
