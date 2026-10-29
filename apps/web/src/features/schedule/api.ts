import {
  scheduleResponseSchema,
  slotExceptionSchema,
  slotSchema,
  type ExceptionInput,
  type SlotInput,
  type SlotPatch,
} from '@organizador/shared';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

export const SCHEDULE_KEY = ['schedule'] as const;

const noContent = z.undefined();

export const fetchSchedule = () => apiGet('/api/v1/schedule', scheduleResponseSchema);

export const createSlot = (input: SlotInput) => apiPost('/api/v1/slots', input, slotSchema);
export const updateSlot = (id: string, patch: SlotPatch) =>
  apiPatch(`/api/v1/slots/${id}`, patch, slotSchema);
export const deleteSlot = (id: string) => apiDelete(`/api/v1/slots/${id}`, noContent);

export const createException = (slotId: string, input: ExceptionInput) =>
  apiPost(`/api/v1/slots/${slotId}/exceptions`, input, slotExceptionSchema);
export const deleteException = (id: string) => apiDelete(`/api/v1/exceptions/${id}`, noContent);
