Here is a clean, production-ready `README.md` tailored specifically for **PujoNavigate**. You can copy and paste this directly into your repository's root `README.md`.

```markdown
# 🪔 PujoNavigate

> A lightweight, mobile-first crowd navigation and accessibility guide for Kolkata Durga Puja.

[![Deploy with Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Vite](https://img.shields.io/badge/Frontend-Vite%20%7C%20React-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Overview

During Durga Puja, millions of visitors navigate dense pedestrian corridors across Kolkata. Bottlenecks, unexpected police diversions, and inaccessible entryways often leave elderly individuals, differently-abled persons, and families stuck in prolonged queues.

**PujoNavigate** is an open-source, mobile-first web app that simplifies festival transit. It provides real-time crowd indicators, wheelchair/senior-friendly entrance routes, and exact metro gate walking paths—engineered to load instantly on budget mobile devices and congested 4G/5G networks.

---

## ✨ Key Features

- **🗺️ Interactive Cluster Map:** High-contrast, lightweight map powered by Leaflet and OpenStreetMap raster tiles (zero expensive API keys, minimal memory overhead).
- **♿ Accessibility-First Filters:** Instant toggles for:
  - Wheelchair / Ramp access
  - Dedicated Senior Citizen queues
  - Medical / First Aid booths
  - Clean public restrooms
- **🚇 Modern Transit Routing:** Direct navigation mapped from key Metro entry/exit gates (including Blue Line, Green Line under the river, and Orange Line corridors).
- **⏱️ Community Wait-Time Pulse:** 1-tap crowd reporting (Walk-in, Steady Queue, Heavy Rush, Gridlock) with auto-decaying 45-minute timestamps.
- **📱 Zero-Friction & Mobile-Ready:** Designed to function seamlessly inside mobile browsers without requiring native app installations.

---

## 🛠️ Tech Stack

- **Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) (Icons)
- **Mapping:** [Leaflet](https://leafletjs.com/) / [React-Leaflet](https://react-leaflet.js.org/)
- **Hosting & CI/CD:** [Render](https://render.com/) (Static Site)

---

## 🚀 Quick Start (Local Setup)

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or later)
- `npm` or `pnpm`

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/sapghosh55-lab/PujoNavigate.git](https://github.com/sapghosh55-lab/PujoNavigate.git)
   cd PujoNavigate

```

2. **Install dependencies:**
```bash
npm install

```


3. **Start the local development server:**
```bash
npm run dev

```


Open `http://localhost:5173` in your browser.
4. **Build for production:**
```bash
npm run build

```


The production-ready assets will be generated in the `dist/` directory.

---

## 📂 Project Structure

```text
PujoNavigate/
├── public/              # Static assets, icons, and geoJSON markers
├── src/
│   ├── assets/          # Custom SVG markers and graphics
│   ├── components/      # UI components (Map, FilterDrawer, CrowdModal)
│   ├── data/            # Curated pandal coordinates and accessibility tags
│   ├── App.jsx          # Main application orchestrator
│   ├── main.jsx         # React DOM mount point
│   └── index.css        # Tailwind directives and custom map CSS
├── index.html           # HTML entry point with mobile viewport settings
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Custom festival-themed color palette
└── package.json

```

---

## 🌐 Deployment (Render)

This project is optimized for deployment as a **Static Site** on Render:

| Field | Configuration |
| --- | --- |
| **Type** | Static Site |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **SPA Rewrite Rule** | Source: `/*` ➔ Destination: `/index.html` |

---

## 🤝 Contributing

Contributions are welcome! If you want to submit crowd data points, update barricade paths, or optimize map rendering:

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AddClusterData`).
3. Commit your Changes (`git commit -m "feat: add Salt Lake pandal coordinates"`).
4. Push to the Branch (`git push origin feature/AddClusterData`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

```

```
