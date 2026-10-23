import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installScrollbars } from './components/scrollbars';
import { refusesFrame, showFramedNotice } from './frameGuard';
import './styles.css';

const root = document.getElementById('root')!;

// Framed by another page, the built app mounts nothing (src/frameGuard.ts).
if (refusesFrame(import.meta.env.PROD)) {
  showFramedNotice(root, window.location.href);
} else {
  installScrollbars();
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
