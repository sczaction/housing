# UI Variations - Jwalith

This folder contains three different UI variations of the S&PAA Housing & Mental Health Resource Finder.

## Versions

### [UI Version 1 - Dashboard Layout](./ui-v1/)
- **Layout**: Sidebar-based dashboard with left search panel and right content area
- **Features**: Step-by-step instructions, welcome panel, card-based results
- **Color Scheme**: Blue gradient background (Light Blue to Slate Blue) with green accents
- **Typography**: Segoe UI, Krub, Rocket

### [UI Version 2 - Hero Layout](./ui-v2/)
- **Layout**: Hero section with two-column search and information layout
- **Features**: Full-width welcome strip, quick guide cards, sage green background
- **Color Scheme**: Sage green background (#739b64) with green and blue accents
- **Typography**: Segoe UI, Krub, Rocket

### [UI Version 3 - Card Grid Layout](./ui-v3/)
- **Layout**: Card-based grid with tabbed search interface
- **Features**: Hero section with gradient, "How It Works" steps, responsive grid results
- **Color Scheme**: Forest green and slate blue gradient hero, light gray background
- **Typography**: Segoe UI, Krub, Rocket

## How to Use

Each version is **self-contained** and can be opened directly:

1. Navigate to any version folder (e.g., `ui-v1`, `ui-v2`, or `ui-v3`)
2. Open `index.html` in your web browser
3. No server required - works with `file://` protocol

All data files (CSV, JSON) and assets (logo) are included in each folder.

## Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for Google Fonts and Leaflet.js map library)
- No additional setup needed

## File Structure

Each version folder contains:
- `index.html` - Main HTML file
- `styles.css` - Styling
- `script.js` - Application logic
- `assets/spaa-logo.png` - S&PAA logo
- `01_master_all_states.csv` - Service data
- `zip_coordinates.json` - Zip code coordinates
- `city_coordinates.json` - City coordinates
