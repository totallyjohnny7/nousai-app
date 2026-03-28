/**
 * MSW Browser Worker — starts mock interception in the browser
 *
 * Activated by localStorage flag: NOUSAI_MOCK_AI=true
 * This file is imported conditionally in main.tsx
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
