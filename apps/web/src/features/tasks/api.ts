import {
  sessionRecordSchema,
  taskListResponseSchema,
  taskSchema,
  type SessionRecordInput,
  type TaskInput,
  type TaskPatch,
  type TaskStatus,
} from '@organizador/shared';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';

export const TASKS_KEY = ['tasks'] as const;

const noContent = z.undefined();

export const fetchTasks = async () => (await apiGet('/api/v1/tasks', taskListResponseSchema)).tasks;

export const createTask = (input: TaskInput) => apiPost('/api/v1/tasks', input, taskSchema);
export const updateTask = (id: string, patch: TaskPatch) =>
  apiPatch(`/api/v1/tasks/${id}`, patch, taskSchema);
export const deleteTask = (id: string) => apiDelete(`/api/v1/tasks/${id}`, noContent);
export const setTaskStatus = (id: string, status: TaskStatus) =>
  apiPut(`/api/v1/tasks/${id}/progress`, { status }, taskSchema);

export const saveSessionRecord = (slotId: string, date: string, input: SessionRecordInput) =>
  apiPut(`/api/v1/session-records/${slotId}/${date}`, input, sessionRecordSchema);
