# AuraFX Elite — MQL5 Market Icon Set

Branded assets for [MQL5 Market](https://www.mql5.com/en/market) product submission.

## Files

| File | Size | Use |
|------|------|-----|
| `aura-icon-200.png` | 200×200 | Primary product logo |
| `aura-icon-140.png` | 140×140 | Thumbnail / compact listing |
| `aura-icon-master.svg` | Vector | Resize for banners, docs, social |

## MQL5 Market upload checklist

1. **Product logo** — upload `aura-icon-200.png` (or 140×140 if required by form)
2. **Screenshots** — minimum 3–5 (see `docs/MARKETPLACE_LISTING.md`)
3. **No guaranteed profit text** on icons or images
4. Keep gold-on-dark branding consistent with on-chart panel

## Regenerate PNG from SVG (optional)

Using Inkscape CLI:

```bash
inkscape aura-icon-master.svg -w 200 -h 200 -o aura-icon-200.png
inkscape aura-icon-master.svg -w 140 -h 140 -o aura-icon-140.png
```

Or open `aura-icon-master.svg` in any browser → export PNG at 200px and 140px.

## Banner (listing header)

Use `../banners/aura-market-banner.svg` (1200×630) in promotional posts or GitHub README.

## Colors (brand)

| Name | Hex |
|------|-----|
| Obsidian BG | `#0a0c12` |
| Panel | `#12182a` |
| Gold | `#d4af37` |
| Buy | `#2ecc71` |
| Sell | `#e74c3c` |
| Risk High | `#e74c3c` |
