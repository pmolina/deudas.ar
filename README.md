# Central de Deudores del BCRA

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&labelColor=20232a)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2-22b5bf)
[![Live demo](https://img.shields.io/badge/Live-deudas.ar-000000?logo=vercel&logoColor=white)](https://deudas.ar/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Look up the debt history of an Argentine CUIT using the [BCRA Central de Deudores](https://www.bcra.gob.ar/BCRAyVos/Sistemas_de_informacion_u_operativos.asp) public API.

## Features

- Single CUIT lookup (with or without dashes)
- Check digit validation using the official AFIP algorithm
- Stacked bar chart showing debt by entity and period
  - Toggle individual entities on/off
  - Bars with irregular credit status (≥ 2) show a red line on their right edge
  - Hover tooltip with per-entity amount, percentage, and situation breakdown
  - On mobile, tap a bar to show a centered tooltip
- Rejected checks table
- API status indicator
- Clean URL routing — results are available at `/{cuit}/` (e.g. `deudas.ar/30546676427/`); legacy `?cuit=` links redirect automatically
- Share options — native share sheet on mobile, clipboard copy on desktop, and a WhatsApp button with a pre-filled message in Spanish; opening a shared link pre-fills and runs the query automatically
- Recent searches history stored in `localStorage`, with quick re-search and per-entry deletion
- Dark mode by default, with light mode toggle and `localStorage` persistence
- Dynamic OG cards — when sharing a CUIT URL, bots receive a 1200x630 card with the person's name, total debt, situation badge, and color-coded background (green/orange/red)
- MIT licensed

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
- [@vercel/og](https://vercel.com/docs/functions/og-image-generation) for dynamic OG image generation (edge runtime)

## Local development

```bash
npm install
npm run dev          # Vite dev server (SPA only)
npm run dev:vercel   # Vercel dev server (SPA + API functions)
```

The OG image endpoint (`/api/og`) only works on Vercel's infrastructure (edge WASM). Use `/api/og-page?cuit=XXXXXXXXXXX` to test the bot HTML locally.

## OG cards architecture

```
Browser  -> /{cuit}/  -> index.html (SPA)
Bot      -> /{cuit}/  -> /api/og-page?cuit=X  -> HTML with <meta og:image="/api/og?cuit=X">
                                                    |
                                               /api/og?cuit=X -> 1200x630 PNG
```

Bot detection is handled at the Vercel routing level via `has` header conditions in `vercel.json` — no middleware or `Vary: User-Agent` needed.

## Build

```bash
npm run build
```

## API

Uses the BCRA public API:

```
GET https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/{cuit}
GET https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/ChequesRechazados/{cuit}
```
