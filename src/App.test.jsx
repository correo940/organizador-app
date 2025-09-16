import { render, screen, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

describe('App routing', () => {
  it('should update the URL when navigating to APLICACIONES', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    // Check that the home view is rendered
    expect(screen.getByText('APLICACIONES')).toBeInTheDocument();

    // Click on the "APLICACIONES" folder
    fireEvent.click(screen.getByText('APLICACIONES'));

    // Check that the URL has updated
    expect(router.state.location.pathname).toBe('/aplicaciones');

    // Check that the applications view is rendered
    expect(screen.getByText('TAREAS')).toBeInTheDocument();
  });
});
