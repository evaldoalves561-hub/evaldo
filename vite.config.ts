import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativo para funcionar também no GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: './',
})
