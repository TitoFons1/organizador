import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { configureZodMessages } from './i18n/zod-es';
import './index.css';
import { applyTheme, storedTheme } from './lib/theme';

configureZodMessages();
// Antes de pintar nada, para que no se vea un destello del tema equivocado.
applyTheme(storedTheme());

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el elemento #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
