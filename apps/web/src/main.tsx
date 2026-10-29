import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { configureZodMessages } from './i18n/zod-es';
import './index.css';

configureZodMessages();

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el elemento #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
