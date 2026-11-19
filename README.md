# @sloth-motion-labs/player

Cursor, scroll and tilt parallax for static SVG.

The asset stays a plain vector drawing. The player reads a small rig — depth,
pivots and anchors authored by the SlothMotion pipeline — and rewrites only
`transform` attributes, on one shared animation frame for the whole page.

- **No dependencies.** ESM, CJS and a UMD bundle for a plain `<script>` tag.
- **One loop per page.** Twenty assets still mean one `requestAnimationFrame`.
- **Pauses when it should.** Off-screen and hidden tabs stop rendering.
- **Respects `prefers-reduced-motion`** by default, with an opt-out policy.

## Install

```bash
npm install @sloth-motion-labs/player
```

Or skip the bundler:

```html
<script src="https://cdn.jsdelivr.net/npm/@sloth-motion-labs/player/dist/sloth.umd.js" defer></script>
```

## Use

### Declarative

```html
<div data-sloth="/assets/teapot.sloth.json" data-sloth-theme="dark"></div>
<script type="module" src="/node_modules/@sloth-motion-labs/player/dist/auto.js"></script>
```

`auto.js` binds every `[data-sloth]` element on load. Attributes:

| Attribute | Values |
| --- | --- |
| `data-sloth` | URL of a `.sloth.json` asset |
| `data-sloth-mode` | `pointer` (default), `scroll`, `tilt`, `auto`, `manual`, `none` |
| `data-sloth-theme` | `light`, `dark`, or a theme name defined by the asset |
| `data-sloth-intensity` | Motion multiplier, e.g. `1.5` |
| `data-sloth-speed` | Idle clock multiplier |
| `data-sloth-idle` | `false` to disable idle motion |
| `data-sloth-poster` | Image shown if the asset fails to load |

### Web component

```html
<script type="module">
  import { defineSlothPlayer } from "@sloth-motion-labs/player/element";
  defineSlothPlayer();
</script>

<sloth-player src="/assets/teapot.sloth.json" mode="pointer" intensity="1.2"></sloth-player>
```

### Imperative

```ts
import { create } from "@sloth-motion-labs/player";

const player = create(
  document.querySelector("#stage")!,
  { url: "/assets/teapot.sloth.json" },
  { mode: "pointer", idle: true, theme: "dark", intensity: 1 },
);

await player.ready;
player.on("press", () => console.log("poked"));
```

You can also pass an asset inline (`{ svg, rig }`) or an already-mounted
`{ element, rig }`, which skips parsing entirely.

## API

| Member | Description |
| --- | --- |
| `create(target, source, options)` | Mounts an asset and returns an instance |
| `instance.ready` | Resolves after the first render, or after a load failure |
| `setCursor(x, y, immediate?)` | Drives the rig from normalized `0…1` coordinates |
| `setNeutral(immediate?)` | Returns to the rest pose |
| `setTheme(tokens)` | Sets `--sloth-*` custom properties on the host |
| `setMode(mode)` | Switches interaction at runtime |
| `setIntensity(n)` | Multiplies motion, `0…3` |
| `setIdle(on)` | Pauses or resumes idle motion |
| `requestTilt()` | Asks for device-orientation permission (iOS) |
| `pause()` / `resume()` | Freezes the render loop |
| `on(event, handler)` | `ready`, `error`, `enter`, `leave`, `press`, `destroy` |
| `destroy()` | Removes listeners, the loop subscription and the SVG |

### Options

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `"pointer"` | `pointer`, `scroll`, `tilt`, `auto`, `manual`, `none` |
| `track` | `"element"` | Sample the pointer over the element or the whole window |
| `idle` | `true` | Run the rig's time-driven motion |
| `intensity` | `1` | Multiplies the rig's default motion |
| `speed` | `1` | Scales the idle clock |
| `response` | `90` | Cursor easing time constant in ms |
| `theme` | `null` | `"light"`, `"dark"` or a token map |
| `sandbox` | `true` | Render inside a shadow root |
| `reducedMotion` | `"fallback"` | `"fallback"` (static), `"idle"` (idle only) or `"full"` |
| `poster` | — | Fallback image |

## Theming

Assets ship semantic colour roles with CSS variable fallbacks, so a brand can
recolour a whole asset from the host page:

```css
#stage {
  --sloth-base: #0f766e;
  --sloth-shadow: #0b3b38;
  --sloth-highlight: #5eead4;
}
```

Nothing in the SVG is inlined into your CSS; the variables are inherited
through the shadow boundary.

## Performance

- Transforms only. No layout, no paint, no filter.
- One `requestAnimationFrame` loop, shared by every instance.
- Rendering stops for hidden documents; use `pause()` for off-screen cards.
- The rig format is plain JSON; a `.sloth.json` asset is one request.

## Asset format

```json
{
  "format": "sloth.asset",
  "version": 1,
  "svg": "<svg …>…</svg>",
  "rig": { "viewBox": [0, 0, 1024, 1024], "nodes": [], "anchors": [] },
  "theme": { "base": "#4f8a6f" }
}
```

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm build       # esm + cjs + umd + types
pnpm size        # gzip budgets
pnpm check       # typecheck + test + build + size
node scripts/serve-demo.mjs   # demo at http://localhost:4322
```

## License

MIT.
