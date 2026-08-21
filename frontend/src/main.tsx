import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './app/App'
import { ProveedorSesion } from './app/sesion'
import { ProveedorVista } from './app/rol'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorVista>
          <App />
        </ProveedorVista>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
)
