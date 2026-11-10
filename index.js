// Glass — neutral frosted-glass theme. The window draws the system's acrylic
// backdrop; the surfaces add only a light grey tint, so the desktop reads
// through the whole window. Without the material (older Windows, software
// graphics, Reduce transparency) Safelight writes the surfaces at full opacity,
// so each one's RGB is also a usable opaque grey.

// The window material blurs only the desktop behind the window, never the
// app's own content, so the frosted glass of popups is drawn here: a Gaussian
// blur of standard deviation 20 (as in Windhawk's BlurAmount) under a light
// grey tint, tuned side by side against the Windhawk translucent Start menu.
// Anything heavier (a wider blur, the backdrop's brightness or contrast pulled
// down) averaged the photos into flat grey. Inside a popup the base surfaces go
// clear, the raised ones become light veils and the dividers fade out, so it
// reads as one sheet the way the Start menu does: rules drawn across the frost
// cut it into panes. Only the popup's own outer edge stays lit.
//
// Popups: menus; Select's dropdown, which is portalled onto <body> (the photo
// grid and filmstrip are listboxes too and must stay clear); top-bar menus,
// the expanded trigger's next sibling; dialogs; and floating dock panels. A
// floating panel takes its frost on a ::before layer, because backdrop-filter
// on the panel itself would make it the containing block of any fixed-position
// popup an extension renders inside it. The rules hold only while the window
// draws a material (sl-material) and this theme is the active one: theme vars
// sit on the root only while their theme is chosen, so the style query keeps
// the frost off other glass themes.
//
// The blur is an SVG filter, not CSS blur(): backdrop-filter paints its result
// over the backdrop rather than in place of it, and in a glass window the gaps
// between thumbnails are nearly transparent (the desktop acrylic is added by
// Windows, outside the page). blur() then leaves those gaps partly clear, and
// the sharp edges underneath show through the frost. The filter first lays the
// backdrop over an opaque grey near the dark acrylic's tone, so the blur comes
// out opaque and covers the whole panel evenly. The blur sees only what lies
// inside the panel (Chromium ignores edgeMode here), so near the panel's own
// edges it fades out again and the sharp backdrop shows along the border;
// setting alpha back to 1 afterwards fixes that, and because filters work on
// unpremultiplied colour, an edge pixel keeps the average of the backdrop
// inside the panel rather than darkening.
const FROST_STD_DEVIATION = 20;
const FROST_BASE = "#2e2e2e";

const FROST_FILTER =
  "<svg xmlns='http://www.w3.org/2000/svg'>" +
  "<filter id='frost' x='0' y='0' width='1' height='1' color-interpolation-filters='sRGB'>" +
  `<feFlood flood-color='${FROST_BASE}' result='base'/>` +
  "<feComposite in='SourceGraphic' in2='base' operator='over' result='flat'/>" +
  `<feGaussianBlur in='flat' stdDeviation='${FROST_STD_DEVIATION}' edgeMode='duplicate'/>` +
  "<feComponentTransfer><feFuncA type='table' tableValues='1 1'/></feComponentTransfer>" +
  "</filter></svg>";

const FROST = `
    background-color: rgb(40 40 40 / 0.28);
    backdrop-filter: url("data:image/svg+xml,${encodeURIComponent(FROST_FILTER)}#frost");`;

const EDGE = `
    border-color: rgb(255 255 255 / 0.1);
    border-top-color: rgb(255 255 255 / 0.18);
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.5);`;

const SHEET = `
    --color-surface-0: transparent;
    --color-surface-1: transparent;
    --color-surface-2: rgb(255 255 255 / 0.06);
    --color-surface-3: rgb(255 255 255 / 0.1);
    --color-surface-4: rgb(255 255 255 / 0.14);
    --color-border: rgb(255 255 255 / 0.06);
    --color-border-subtle: transparent;`;

const OVERLAY_CSS = `
@container style(--theme-glass-active: 1) {
  html.sl-material [role="menu"],
  html.sl-material body > [role="listbox"],
  html.sl-material [role="dialog"],
  html.sl-material [role="alertdialog"],
  html.sl-material [aria-haspopup="true"][aria-expanded="true"] + * {${FROST}${EDGE}${SHEET}
  }
  html.sl-material .sl-floating-panel {
    background-color: transparent;${EDGE}${SHEET}
  }
  html.sl-material .sl-floating-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;${FROST}
  }
}
`;

export function activate(api) {
  api.registerTheme({
    id: "theme-glass.theme",
    name: "Glass",
    colorScheme: "dark",
    window: { material: "acrylic" },
    vars: {
      "--color-surface-0": "rgb(12 12 12 / 0.6)",
      "--color-surface-1": "rgb(56 56 56 / 0.3)",
      "--color-surface-2": "rgb(96 96 96 / 0.3)",
      "--color-surface-3": "rgb(112 112 112 / 0.35)",
      "--color-surface-4": "rgb(128 128 128 / 0.4)",
      "--color-border": "rgb(128 128 128 / 0.32)",
      "--color-border-subtle": "rgb(128 128 128 / 0.16)",
      "--color-text-primary": "#f5f5f5",
      "--color-text-secondary": "#c4c4c4",
      "--color-text-muted": "#aaaaaa",
      "--color-accent": "#d6d6d6",
      "--color-accent-hover": "#ececec",
      "--color-slider-fill": "#b0b0b0",
      "--color-on-accent": "#121212",
      "--theme-glass-active": "1",
    },
  });
  api.registerStylesheet({ id: "theme-glass.overlays", css: OVERLAY_CSS });
}
