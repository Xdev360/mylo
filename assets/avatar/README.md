# Mylo avatar kit — drop-in parts

Every part is an SVG on the **same canvas**:

```text
viewBox="0 0 80 80"
```

## Folders = layers (draw order)

| Folder | Layer id | Tab | Notes |
|--------|----------|-----|--------|
| `base/` | `base` | Body | Silhouette (black fill) — tinted by color |
| `eyes/` | `eyes` | Face | Close-up eyes |
| `mouth/` | `mouth` | Face | Mouths |
| `accessories/` | `accessories` | Face | Optional extras (`none.svg` = empty) |

Color is chosen in the UI (no file). Base uses a CSS mask so color swaps live.

## Add a new part

1. Export SVG with `viewBox="0 0 80 80"`.
2. For **base**, use a solid black silhouette (color is applied in-app).
3. Save e.g. `eyes/star.svg`.
4. Register in `js/avatar-kit.js` under that layer’s `options`:

```js
{ id: 'star', label: 'Star' }
```

Path is always: `assets/avatar/{layer}/{id}.svg`
