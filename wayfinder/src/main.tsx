import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { WorkspaceShell } from '@salientform/workspace-wayfinder';
import { startTheme } from '@salientform/workspace-wayfinder/theme';
import { router } from './router';
import { workspace } from './workspace';
import './styles.css';

// The kit's theme, started before anything renders so the first paint is right: the reader's remembered choice, or
// their system setting until they choose, as the `dark` class on <html>. The header's ThemeToggle (workspace.tsx)
// changes it. A repository with a theme system of its own sets the class from that instead, passes its own control as
// `headerActions`, and has neither line.
startTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <WorkspaceShell workspace={workspace} router={router} />
  </StrictMode>
);
