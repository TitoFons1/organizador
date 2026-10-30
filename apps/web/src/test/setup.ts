import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { configureZodMessages } from '../i18n/zod-es';

configureZodMessages();

// Con la cobertura activada, el Panel (semana + pendientes) puede tardar mas de 1 s en pintarse en
// Windows: los `findBy*` esperan hasta 3 s en vez de 1 s. No retrasa los tests que ya pasan.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
