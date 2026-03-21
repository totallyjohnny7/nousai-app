/**
 * StreamDeckBridge — WebSocket client connecting Nous web app to Stream Deck plugin.
 *
 * The Stream Deck plugin (Node.js) hosts the WS server on localhost:8765.
 * The browser tab connects as a client.
 *
 * Protocol version 1:
 * - Browser → Plugin: NousState (every 1s during study sessions)
 * - Plugin → Browser: DeckAction (button presses)
 */

export interface DeckAction {
  version: 1;
  action: string;
  payload?: Record<string, unknown>;
}

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

type ActionHandler = (action: DeckAction) => void;

const DEFAULT_PORT = 8765;
const MAX_PORT = 8770;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 5000;
const MAX_MISSED_PONGS = 3;

class StreamDeckBridge {
  private ws: WebSocket | null = null;
  private actionHandlers: Set<ActionHandler> = new Set();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private missedPongs = 0;
  private currentPort = DEFAULT_PORT;
  private _connected = false;

  get connected(): boolean { return this._connected; }

  connect(): void {
    this.tryConnect(DEFAULT_PORT);
  }

  private tryConnect(port: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(`ws://localhost:${port}`);
      this.currentPort = port;

      this.ws.onopen = () => {
        console.log(`[StreamDeckBridge] Connected on port ${port}`);
        this._connected = true;
        this.reconnectAttempt = 0;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PONG') {
            this.missedPongs = 0;
            return;
          }
          // Dispatch action to handlers
          this.actionHandlers.forEach(h => h(data as DeckAction));
        } catch {}
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Try next port if initial connection fails
        if (!this._connected && port < MAX_PORT) {
          this.ws?.close();
          this.tryConnect(port + 1);
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  sendState(state: NousState): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(state));
    }
  }

  onAction(handler: ActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => { this.actionHandlers.delete(handler); };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.missedPongs = 0;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
        this.missedPongs++;
        if (this.missedPongs >= MAX_MISSED_PONGS) {
          console.warn('[StreamDeckBridge] Heartbeat timeout, reconnecting');
          this.ws?.close();
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt) + Math.random() * 1000,
      RECONNECT_MAX_MS
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.tryConnect(this.currentPort);
    }, delay);
  }
}

// Singleton
export const streamDeckBridge = new StreamDeckBridge();
