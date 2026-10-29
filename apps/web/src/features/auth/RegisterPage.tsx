import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MIN_LENGTH, registerFormSchema, type RegisterForm } from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { AuthLayout } from './AuthLayout';
import { authErrorMessage, fetchMe, signUp } from './auth-api';
import { ME_QUERY_KEY } from './useMe';

export function RegisterPage() {
  const queryClient = useQueryClient();
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const register = useMutation({
    mutationFn: signUp,
    // Registrarse ya abre sesion: basta con cargar el perfil, `GuestOnly` redirige al detectarlo.
    onSuccess: () =>
      queryClient.fetchQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe, staleTime: 0 }),
  });

  const { errors } = form.formState;

  return (
    <AuthLayout title={es.auth.registerTitle} subtitle={es.auth.registerSubtitle}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => register.mutate(values))}
        className="flex flex-col gap-4"
      >
        <Field
          label={es.auth.name}
          autoComplete="name"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Field
          label={es.auth.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <Field
          label={es.auth.password}
          type="password"
          autoComplete="new-password"
          hint={es.auth.passwordHint(PASSWORD_MIN_LENGTH)}
          error={errors.password?.message}
          {...form.register('password')}
        />
        {register.isError ? (
          <p role="alert" className="text-sm text-danger">
            {authErrorMessage(register.error)}
          </p>
        ) : null}
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? es.auth.submitting : es.auth.submitRegister}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-muted">
        {es.auth.haveAccount}{' '}
        <Link to="/entrar" className="font-medium text-primary underline">
          {es.auth.goLogin}
        </Link>
      </p>
    </AuthLayout>
  );
}
