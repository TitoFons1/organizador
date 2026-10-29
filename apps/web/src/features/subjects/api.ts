import {
  subjectImpactSchema,
  subjectListResponseSchema,
  subjectSchema,
  trashListResponseSchema,
  type SubjectInput,
  type SubjectPatch,
  type TrashEntity,
} from '@organizador/shared';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';

export const SUBJECTS_KEY = ['subjects'] as const;
export const TRASH_KEY = ['trash'] as const;
export const subjectImpactKey = (id: string) => ['subjects', id, 'impact'] as const;

const noContent = z.undefined();

export const fetchSubjects = async () =>
  (await apiGet('/api/v1/subjects', subjectListResponseSchema)).subjects;

export const createSubject = (input: SubjectInput) =>
  apiPost('/api/v1/subjects', input, subjectSchema);

export const updateSubject = (id: string, patch: SubjectPatch) =>
  apiPatch(`/api/v1/subjects/${id}`, patch, subjectSchema);

export const archiveSubject = (id: string) =>
  apiPost(`/api/v1/subjects/${id}/archive`, undefined, subjectSchema);

export const unarchiveSubject = (id: string) =>
  apiPost(`/api/v1/subjects/${id}/unarchive`, undefined, subjectSchema);

export const reorderSubjects = async (ids: string[]) =>
  (await apiPut('/api/v1/subjects/order', { ids }, subjectListResponseSchema)).subjects;

export const fetchSubjectImpact = (id: string) =>
  apiGet(`/api/v1/subjects/${id}/impact`, subjectImpactSchema);

export const deleteSubject = (id: string, confirmName: string) =>
  apiDelete(`/api/v1/subjects/${id}`, noContent, { confirmName });

export const fetchTrash = async () =>
  (await apiGet('/api/v1/trash', trashListResponseSchema)).items;

export const restoreFromTrash = (entity: TrashEntity, id: string) =>
  apiPost(`/api/v1/trash/${entity}/${id}/restore`, undefined, noContent);
