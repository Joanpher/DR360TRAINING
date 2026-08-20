import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /*
      La API se sirve bajo el mismo origen que la aplicacion. Asi la cookie
      httpOnly del refresco viaja sin pelearse con CORS ni con SameSite, y en
      produccion el reverse proxy hara exactamente lo mismo: /api al backend,
      el resto a los archivos estaticos.
    */
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
