/**
 * Nous AI Stream Deck Plugin — Main Entry
 *
 * Registers all actions and starts the WebSocket server
 * for communication with the Nous web app.
 */

import { nousClient } from './nous-client';

// Start WebSocket server on plugin load
nousClient.start();

// Log state updates for debugging
nousClient.onState((state) => {
  console.log(`[Plugin] State: ${state.phase} | Cards: ${state.cardsReviewed}/${state.total} | Eff: ${Math.round(state.efficiency * 100)}%`);
});

console.log('[Plugin] Nous AI Stream Deck Plugin loaded');

// Action handlers will be registered here as they're built
// For now, the plugin just relays between Stream Deck buttons and the Nous web app

// Graceful shutdown
process.on('SIGINT', () => {
  nousClient.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  nousClient.stop();
  process.exit(0);
});
