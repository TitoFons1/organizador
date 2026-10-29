import {
  calendarResponseSchema,
  importResultSchema,
  markSchema,
  termSchema,
  type MarkInput,
  type MarkPatch,
  type TermInput,
  type TermPatch,
} from '@organizador/shared';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

export const CALENDAR_KEY = ['calendar'] as const;

const noContent = z.undefined();

export const fetchCalendar = () => apiGet('/api/v1/calendar', calendarResponseSchema);

export const importSeed = () =>
  apiPost('/api/v1/calendar/import-seed', undefined, importResultSchema);

export const createMark = (input: MarkInput) => apiPost('/api/v1/marks', input, markSchema);
export const updateMark = (id: string, patch: MarkPatch) =>
  apiPatch(`/api/v1/marks/${id}`, patch, markSchema);
export const deleteMark = (id: string) => apiDelete(`/api/v1/marks/${id}`, noContent);

export const createTerm = (input: TermInput) => apiPost('/api/v1/terms', input, termSchema);
export const updateTerm = (id: string, patch: TermPatch) =>
  apiPatch(`/api/v1/terms/${id}`, patch, termSchema);
export const deleteTerm = (id: string) => apiDelete(`/api/v1/terms/${id}`, noContent);
