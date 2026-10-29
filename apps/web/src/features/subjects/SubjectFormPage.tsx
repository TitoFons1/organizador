import { zodResolver } from '@hookform/resolvers/zod';
import { SUBJECT_SHORT_NAME_MAX, type Subject } from '@organizador/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { createSubject, fetchSubjects, SUBJECTS_KEY, updateSubject } from './api';
import { ColorPicker } from './ColorPicker';
import {
  fromSubject,
  subjectFormSchema,
  toSubjectInput,
  type SubjectFormValues,
} from './subject-form';

/** Alta (`/asignaturas/nueva`) y edicion (`/asignaturas/:id/editar`) comparten formulario. */
export function SubjectFormPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });

  if (id === undefined) return <SubjectForm />;
  if (query.isPending) return <p className="text-fg-muted">{es.common.loading}</p>;
  const subject = query.data?.find((candidate) => candidate.id === id);
  if (!subject) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{es.subjects.notFound}</p>
        <Link to="/asignaturas" className={buttonClasses('secondary')}>
          {es.common.back}
        </Link>
      </div>
    );
  }
  return <SubjectForm subject={subject} />;
}

function SubjectForm({ subject }: { subject?: Subject }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: fromSubject(subject),
  });

  const save = useMutation({
    mutationFn: (values: SubjectFormValues) =>
      subject
        ? updateSubject(subject.id, toSubjectInput(values))
        : createSubject(toSubjectInput(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY });
      void navigate('/asignaturas');
    },
  });

  const { errors } = form.formState;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {subject ? es.subjects.editTitle : es.subjects.newTitle}
      </h1>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-4"
      >
        <Field
          label={es.subjects.name}
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Field
          label={es.subjects.shortName}
          hint={es.subjects.shortNameHint}
          maxLength={SUBJECT_SHORT_NAME_MAX}
          autoComplete="off"
          error={errors.shortName?.message}
          {...form.register('shortName')}
        />
        <Field
          label={es.subjects.teacherField}
          autoComplete="off"
          error={errors.teacher?.message}
          {...form.register('teacher')}
        />
        <ColorPicker {...form.register('color')} />

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-sm font-medium">{es.subjects.links}</legend>
          <Field
            label={es.subjects.classroom}
            type="url"
            inputMode="url"
            placeholder="https://"
            error={errors.classroom?.message}
            {...form.register('classroom')}
          />
          <Field
            label={es.subjects.notebooklm}
            type="url"
            inputMode="url"
            placeholder="https://"
            error={errors.notebooklm?.message}
            {...form.register('notebooklm')}
          />
          <Field
            label={es.subjects.repo}
            type="url"
            inputMode="url"
            placeholder="https://"
            error={errors.repo?.message}
            {...form.register('repo')}
          />
        </fieldset>

        {save.isError ? (
          <p role="alert" className="text-sm text-danger">
            {es.subjects.actionError}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit" disabled={save.isPending} className="flex-1">
            {save.isPending ? es.common.saving : es.common.save}
          </Button>
          <Link to="/asignaturas" className={buttonClasses('secondary')}>
            {es.common.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
