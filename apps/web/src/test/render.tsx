import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router';
import { routes } from '../App';

export function renderApp(initialEntry: InitialEntry = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client };
}
