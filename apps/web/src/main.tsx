import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Dev: si el espejo Dexie está vacío, siembra datos de demostración para poder
// probar el hub ya mismo (NUNCA en producción: `import.meta.env.DEV` es false
// en el build). La lista de usuarios, el personal de la venta, clientes, zonas,
// catálogo y tasa BCV pasan a estar disponibles sin configuración previa.
if (import.meta.env.DEV) {
  void import('./dev/demoData').then((m) => m.seedDemoSiVacio());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
