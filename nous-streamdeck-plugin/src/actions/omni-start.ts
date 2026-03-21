/**
 * Omni Start Action — Starts the 60-min Omni Protocol in Nous.
 * UUID: com.nousai.omni.start
 */

import { nousClient } from '../nous-client';

export function handleOmniStart(): void {
  nousClient.sendAction('OMNI_START', { duration: 60 });
  console.log('[Action] Omni Protocol started');
}
