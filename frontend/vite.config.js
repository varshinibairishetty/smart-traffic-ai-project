// vite.config.js
// Vite is the build tool that compiles and serves the React app.
// This config tells Vite to use the React plugin (enables JSX + fast refresh).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,   // open http://localhost:5173 after running `npm run dev`
  },
})
