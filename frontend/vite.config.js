import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages serves a project site from https://<user>.github.io/<repo>/,
// so the build needs that repo-name subpath baked in. Local dev (`npm run
// dev`) is unaffected — Vite only applies `base` to the production build.
export default defineConfig({
  base: '/thesis-room/',
  plugins: [react()],
})
