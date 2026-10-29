import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { signOut } from './auth-api';
import { ME_QUERY_KEY, useMe } from './useMe';

export function AccountCard() {
  const me = useMe();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: signOut,
    onSettled: () => {
      // Se descarta todo lo cacheado de esta persona para que la siguiente no lo vea.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  });

  if (!me.data) return null;
  const { user, workspace } = me.data;

  return (
    <section
      aria-label={es.auth.account}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-sm text-fg-muted">{user.email}</p>
        <p className="mt-1 text-xs text-fg-muted">
          {es.auth.workspace}: {workspace.name}
        </p>
      </div>
      <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
        <LogOut aria-hidden className="size-4" />
        {logout.isPending ? es.auth.loggingOut : es.auth.logout}
      </Button>
    </section>
  );
}
