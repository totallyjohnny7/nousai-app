/**
 * Tab Leader Election — ensures only one tab writes to IDB at a time.
 *
 * Uses pubkey/broadcast-channel's leader election to designate a single
 * "leader" tab that owns all IDB writes. Follower tabs proxy their mutations
 * through the BroadcastChannel → the leader applies them → broadcasts the
 * updated state back.
 *
 * If the leader tab closes, another tab is automatically elected within ~3s.
 */
import { BroadcastChannel as BC, createLeaderElection, type LeaderElector } from 'broadcast-channel';

export type TabRole = 'leader' | 'follower' | 'undecided';

const CHANNEL_NAME = 'nousai-data-sync';

let channel: BC | null = null;
let elector: LeaderElector | null = null;
let _role: TabRole = 'undecided';
let _onBecomeLeader: (() => void) | null = null;
let _onLoseLeadership: (() => void) | null = null;
let _onMessage: ((msg: any) => void) | null = null;

/** Unique ID for this tab — used to filter own broadcasts */
export const TAB_ID = crypto.randomUUID();

/** Current role of this tab */
export function getRole(): TabRole {
  return _role;
}

export function isLeader(): boolean {
  return _role === 'leader';
}

/** Initialize the leader election system */
export async function initLeaderElection(opts: {
  onBecomeLeader: () => void;
  onLoseLeadership: () => void;
  onMessage: (msg: any) => void;
}) {
  _onBecomeLeader = opts.onBecomeLeader;
  _onLoseLeadership = opts.onLoseLeadership;
  _onMessage = opts.onMessage;

  try {
    channel = new BC(CHANNEL_NAME);
    elector = createLeaderElection(channel);

    // Listen for messages from other tabs
    channel.onmessage = (msg: any) => {
      if (msg?.tabId === TAB_ID) return; // ignore own messages
      _onMessage?.(msg);
    };

    // Attempt to become leader — resolves when this tab IS the leader
    elector.awaitLeadership().then(() => {
      _role = 'leader';
      console.log('[TAB-LEADER] This tab is now the leader');
      _onBecomeLeader?.();
    });

    // The library handles re-election when the leader tab closes.
    // `elector.onduplicate` fires if another tab also thinks it's leader (rare).
    elector.onduplicate = () => {
      console.warn('[TAB-LEADER] Duplicate leader detected — yielding');
      _role = 'follower';
      _onLoseLeadership?.();
    };

    // If we're not the leader after a short wait, we're a follower
    setTimeout(() => {
      if (_role === 'undecided') {
        _role = 'follower';
        console.log('[TAB-LEADER] This tab is a follower');
      }
    }, 2000);
  } catch (e) {
    // BroadcastChannel not supported — single-tab fallback, always leader
    console.warn('[TAB-LEADER] BroadcastChannel unavailable, running as solo leader:', e);
    _role = 'leader';
    _onBecomeLeader?.();
  }
}

/** Post a message to all other tabs */
export function broadcast(msg: Record<string, unknown>) {
  channel?.postMessage({ ...msg, tabId: TAB_ID });
}

/** Clean up on unmount */
export async function destroyLeaderElection() {
  try {
    if (elector) {
      // If we're leader, this triggers re-election in other tabs
      await elector.die();
      elector = null;
    }
    if (channel) {
      await channel.close();
      channel = null;
    }
  } catch (e) {
    console.warn('[TAB-LEADER] Cleanup error:', e);
  }
  _role = 'undecided';
}
