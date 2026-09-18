import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { pwa } from './app/pwaController';
import './app/styles.css';

pwa.start(registerSW);

// 端末のストレージ逼迫時にIndexedDBが勝手に消されないよう、永続化をお願いする(失敗しても致命的ではない)。
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
