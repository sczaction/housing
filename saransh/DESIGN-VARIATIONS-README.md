# Search Tool – 5 UI/UX Design Variations

These variations follow the **2026-01-15 Search Tool Design Guidelines** for colors, typography, and presentation. The NGO logo from **download.jpg** is used in all variations.

## Rule #1

**Never change the matter inside `index.html`.** All variants use the same HTML content; only `styles.css` (and assets/scripts) differ.

## Quick start (how to run)

There is **no build step**. Each variation is a self-contained static folder.

- **Fastest**: open the variation’s `index.html` in your browser.
  - Example: open `design-v4/index.html` or `design-v5/index.html`
- **Recommended** (more reliable for local JSON fetch + browser security): run a local server and open the provided local URL.

### Option A — Python (recommended)

From the `saransh/` folder (the one that contains `design-v1/`, `design-v2/`, `design-v3/`, `design-v4/`, `design-v5/`):

```bash
python -m http.server 5000
```

Then open:

- `http://localhost:5000/design-v1/`
- `http://localhost:5000/design-v2/`
- `http://localhost:5000/design-v3/`
- `http://localhost:5000/design-v4/`
- `http://localhost:5000/design-v5/`

### Option B — Node (if you prefer)

```bash
npx http-server . -p 5173
```

Open the same URLs as above.

### Notes / troubleshooting

- **Internet required**: the map libraries load from CDNs and the CSV data is fetched from GitHub.
- If the page looks unstyled, confirm you opened the correct `index.html` and that `styles.css` exists in the same folder.
- If data doesn’t load when opening the file directly, use a local server (Option A/B).

## Design system (all variations)

- **Colors:** Forest Green `#52694c`, Slate Blue `#627c88`, Light Blue `#bad5e2`, Sage Green `#739b64`, Light Gray `#e7e7e9`, Medium Gray `#919091`, Charcoal `#54595F`
- **Typography:** Segoe UI, Krub (Google Font), Rocket, sans-serif — body 16–18px, line-height 1.6, Charcoal for text
- **Logo:** NGO symbol (download.jpg), minimum 150px width for digital
- **Accessibility:** Charcoal on white for text, minimum 4.5:1 contrast where required

## How to open each variation

Open the `index.html` in each folder in a browser (e.g. open file, or use a local server):

| Variation | Folder | Description |
|-----------|--------|-------------|
| **V1 – Classic card** | `design-v1/` | Card layout, white/light-gray background, Forest Green & Slate Blue CTAs |
| **V2 – Two-column split** | `design-v2/` | Search-first: two cards side-by-side (Search by Location \| Find Near Me), instructions after header, results in a two-column grid |
| **V3 – Sidebar + Main** | `design-v3/` | Left sidebar (instructions + search), right main (results); two-column grid on desktop, single column on mobile |
| **V4 – Single-line search bar** | `design-v4/` | One horizontal strip with inline controls; user-friendly (larger touch targets, clearer labels, visible help text, focus/hover states). |
| **V5 – Narrow centered flow** | `design-v5/` | One narrow column (560px) centered: header, instructions, then both search methods stacked with Step 1 / Step 2 labels and "or" between them. User-friendly spacing, touch targets, and softer visuals. Results full width. |

Each folder contains:

- `index.html` – **same markup and content** in all variants (Rule #1)
- `styles.css` – variation-specific layout and visuals (same design tokens)
- `script.js` – shared search/map logic
- `download.jpg` – NGO logo asset
- `zip_coordinates.json` – local zip coordinates for map/proximity
- `city_coordinates.json` – local city coordinates for map/proximity
