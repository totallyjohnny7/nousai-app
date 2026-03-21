/**
 * NousClient — WebSocket server that the Nous web app connects to.
 *
 * The plugin (this Node.js process) hosts the WS server on localhost:8765.
 * The browser tab connects as a client.
 */

import { WebSocketServer, WebSocket } from 'ws';

export interface NousState {
  version: 1;
  type: 'STATE_UPDATE';
  phase: string;
  phaseTimeRemaining: number;
  cardsReviewed: number;
  total: number;
  retention: number;
  efficiency: number;
  streak: number;
  xp: number;
  currentMode: string;
  currentSubject: string;
  focusLocked: boolean;
  interleaveMode: string;
}

export interface DeckAction {
  version: 1;
  action: string;
  payload?: Record<string, unknown>;
}

type StateHandler = (state: NousState) => void;

const PORT = 8765;

class NousClient {
  private wss: WebSocketServer | null = null;
  private browserSocket: WebSocket | null = null;
  private stateHandlers: Set<StateHandler> = new Set();
  private _lastState: NousState | null = null;

  get connected(): boolean {
    return this.browserSocket?.readyState === WebSocket.OPEN;
  }

  get lastState(): NousState | null {
    return this._lastState;
  }

  start(): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ port: PORT, host: 'localhost' });
    console.log(`[NousClient] WebSocket server listening on ws://localhost:${PORT}`);

    this.wss.on('connection', (ws) => {
      console.log('[NousClient] Browser connected');
      this.browserSocket = ws;

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Handle heartbeat
          if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG' }));
            return;
          }

          // Handle state updates
          if (msg.type === 'STATE_UPDATE') {
            this._lastState = msg as NousState;
            this.stateHandlers.forEach(h => h(msg as NousState));
          }
        } catch {}
      });

      ws.on('close', () => {
        console.log('[NousClient] Browser disconnected');
        this.browserSocket = null;
      });
    });
  }

  stop(): void {
    this.browserSocket?.close();
    this.wss?.close();
    this.wss = null;
    this.browserSocket = null;
  }

  /** Send an action to the Nous web app */
  sendAction(action: string, payload?: Record<string, unknown>): void {
    if (!this.connected) return;
    const msg: DeckAction = { version: 1, action, payload };
    this.browserSocket!.send(JSON.stringify(msg));
  }

  /** Subscribe to state updates from the browser */
  onState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => { this.stateHandlers.delete(handler); };
  }
}

export const nousClient = new NousClient();
