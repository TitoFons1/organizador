import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormSchema, type LoginForm } from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { AuthLayout } from './AuthLayout';
import { authErrorMessage, fetchMe, signIn } from './auth-api';
import { ME_QUERY_KEY } from './useMe';

export function LoginPage() {
  const queryClient = useQueryClient();
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: signIn,
    // Basta con dejar la sesion en cache: `GuestOnly` redirige al detectarla.
    onSuccess: () =>
      queryClient.fetchQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe, staleTime: 0 }),
  });

  const { errors } = form.formState;

  return (
    <AuthLayout title={es.auth.loginTitle} subtitle={es.auth.loginSubtitle}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
        className="flex flex-col gap-4"
      >
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        {login.isError ? (
          <p role="alert" className="text-sm text-danger">
            {authErrorMessage(login.error)}
          </p>
        ) : null}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? es.auth.submitting : es.auth.submitLogin}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-muted">
        {es.auth.noAccount}{' '}
        <Link to="/registro" className="font-medium text-primary underline">
          {es.auth.goRegister}
        </Link>
      </p>
    </AuthLayout>
  );
}
