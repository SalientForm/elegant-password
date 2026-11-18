import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceShell } from '@salientform/workspace-wayfinder';
import { router } from './router';
import { queryClient } from './query-client';
import { workspace } from './workspace';
import './styles.css';

// The kit's dark theme is the `dark` class on <html>: follow the reader's system setting. A repository with a theme
// provider of its own (and a toggle in `headerActions`) sets the class from that instead.
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const applyScheme = () => document.documentElement.classList.toggle('dark', darkScheme.matches);
applyScheme();
darkScheme.addEventListener('change', applyScheme);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WorkspaceShell workspace={workspace} router={router} />
    </QueryClientProvider>
  </StrictMode>
);
