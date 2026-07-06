# Parslia Kitchen OS

Marketing site for **Parslia Kitchen OS** — smart kitchen software for chefs and food teams.

## Live preview (local)

Open `index.html` in a browser, or serve the folder:

```bash
npx --yes serve .
```

Then visit http://localhost:3000

## Deploy to GitHub Pages

This repo is structured for **GitHub Pages** from the root (`index.html`, `.nojekyll`).

1. Push this repo to https://github.com/shyam1-jpg/parslia-kitchen-os
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Optional custom domain: **parslia.app** (add DNS `CNAME` → `shyam1-jpg.github.io` or repo Pages URL)

Or double-click **`PUSH-PARSLIA-TO-GITHUB.bat`** on Windows (uses your GitHub login).

## Assets

Add branded PNGs to `assets/` with these exact names (see `assets/README.txt`):

- `USE_THIS_parslia_header_logo_clean.png`
- `USE_THIS_parslia_app_icon_1024.png`

Until then, the header shows the **Parslia Kitchen OS** text fallback. `assets/logo.svg` is included as a leaf mark.

## Stack

Static HTML, CSS, and JavaScript — no build step.

---

© Parslia Kitchen OS
