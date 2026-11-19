# Changelog

## 0.2.1

- Pointer, scroll and tilt listeners are now bound on creation. Before, they
  were only bound when the mode changed, so an asset created in `pointer`
  mode ignored the cursor until `setMode` was called.

## 0.2.0

- Motion strength can be authored per asset via `rig.defaults.intensity`;
  an explicit `intensity` option still overrides it.
- The preview renderer and the player now resolve the same multipliers, so
  regenerated previews match the interactive asset.

## 0.1.0

First public release.

- `create()` with pointer, scroll, tilt, idle, manual and static modes.
- Shared page-level animation loop with visibility and reduced-motion handling.
- Declarative `data-sloth` binding and a `<sloth-player>` custom element.
- Theme tokens as `--sloth-*` custom properties, inherited across the shadow root.
- ESM, CJS and UMD builds with gzip budgets enforced in CI.
