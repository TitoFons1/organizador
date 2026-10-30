import type { Task, TaskStatus } from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTaskStatus, TASKS_KEY } from './api';

/**
 * Marca el estado propio de una tarea. Se aplica en pantalla al instante (la tarea cambia de
 * grupo sin esperar al servidor, criterio de M5) y se deshace si el servidor lo rechaza.
 */
export function useTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => setTaskStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData<Task[]>(TASKS_KEY);
      queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
        tasks?.map((task) =>
          task.id === id
            ? { ...task, status, doneAt: status === 'done' ? new Date().toISOString() : null }
            : task,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(TASKS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
