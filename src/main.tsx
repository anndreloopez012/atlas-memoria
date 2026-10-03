import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource-variable/jetbrains-mono';
import './estilos/base.css';
import './estilos/markdown.css';
import './estilos/app.css';
import './lib/tema';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
