import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './router';
import { queryClient } from './shared/api/queryClient';
import { appTheme } from './shared/design-system/theme.js';
import '@fontsource-variable/roboto/index.css';
import './shared/design-system/motion.css';

dayjs.locale('vi');

// Auto-recover from stale chunks after a new deployment (Vite dynamic import 404).
const reloadOnChunkError = () => {
  const lastReload = sessionStorage.getItem('chunk_reload');
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 10_000) {
    sessionStorage.setItem('chunk_reload', String(now));
    window.location.reload();
  }
};

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnChunkError();
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    reloadOnChunkError();
  }
});

const reducedMotionPreference = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
);
const reducedMotionTheme = {
  ...appTheme,
  token: { ...appTheme.token, motion: false },
};

function subscribeToMotionPreference(onChange: () => void) {
  reducedMotionPreference.addEventListener('change', onChange);
  return () => reducedMotionPreference.removeEventListener('change', onChange);
}

function getMotionPreference() {
  return reducedMotionPreference.matches;
}

function Application() {
  const reduceMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
  );

  return (
    <ConfigProvider
      locale={viVN}
      theme={reduceMotion ? reducedMotionTheme : appTheme}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
);
