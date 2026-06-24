import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PORTAAPI = 5176;

export default defineConfig({
  plugins: [react()],

  // Configuração do servidor de desenvolvimento
  server: {
    host: true,
    port: PORTAAPI,
    strictPort: true
  }
})