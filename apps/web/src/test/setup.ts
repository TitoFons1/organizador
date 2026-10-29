import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { configureZodMessages } from '../i18n/zod-es';

configureZodMessages();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
