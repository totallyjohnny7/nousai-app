/**
 * Tab Leader Election — ensures only one tab writes to IDB at a time.
 *
 * Uses pubkey/broadcast-channel's leader election to designate a single
 * "leader" tab that owns all IDB writes. Follower tabs proxy their mutations
 * through the BroadcastChannel → the leader applies them → broadcasts the
 * updated state back.
 *
 * If the leader tab closes, another tab is automatically elected within ~3s.
 *
 * IMPORTANT: Chrome extensions (Claude in Chrome, Kapture, etc.) can register
 * on the same BroadcastChannel and interfere with leader election, causing
 * `onduplicate` to fire even with a single app tab open. The ping/pong
 * protocol below verifies real app tabs exist before yielding leadership.
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

/**
 * Verify another real NousAI tab exists by sending a ping and waiting for a
 * pong. Returns true if another tab responds within 500ms.
 */
function verifyOtherTabExists(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!channel) { resolve(false); return; }

    let answered = false;
    const onMsg = (msg: any) => {
      if (msg?.type === 'leader-pong' && msg?.tabId !== TAB_ID) {
        answered = true;
        resolve(true);
      }
    };

    // Temporarily listen for pong
    const origHandler = channel.onmessage;
    channel.onmessage = (msg: any) => {
      onMsg(msg);
      // Still run original handler
      if (msg?.tabId !== TAB_ID) _onMessage?.(msg);
    };

    channel.postMessage({ type: 'leader-ping', tabId: TAB_ID });

    setTimeout(() => {
      // Restore original handler
      if (channel) {
        channel.onmessage = origHandler;
      }
      if (!answered) resolve(false);
    }, 500);
  });
}

/** Force this tab to leader — used when no other real tabs exist */
function forceLeader() {
  if (_role === 'leader') return;
  _role = 'leader';
  console.log('[TAB-LEADER] This tab is now the leader');
  _onBecomeLeader?.();
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

      // Respond to pings so other tabs can verify we're a real app tab
      if (msg?.type === 'leader-ping') {
        channel?.postMessage({ type: 'leader-pong', tabId: TAB_ID });
        return;
      }

      _onMessage?.(msg);
    };

    // Attempt to become leader — resolves when this tab IS the leader
    elector.awaitLeadership().then(() => {
      forceLeader();
    });

    // `elector.onduplicate` fires if another tab also thinks it's leader.
    // Chrome extensions can trigger this falsely — verify before yielding.
    elector.onduplicate = async () => {
      console.warn('[TAB-LEADER] Duplicate leader detected — verifying other tabs...');
      const otherExists = await verifyOtherTabExists();
      if (otherExists) {
        console.log('[TAB-LEADER] Confirmed other app tab — yielding to follower');
        _role = 'follower';
        _onLoseLeadership?.();
      } else {
        console.log('[TAB-LEADER] No other app tab responded — keeping leadership');
        forceLeader();
      }
    };

    // If we're not the leader after a short wait, check if another tab exists.
    // If no real tab responds, promote ourselves to leader (single-tab scenario).
    setTimeout(async () => {
      if (_role === 'undecided') {
        const otherExists = await verifyOtherTabExists();
        if (otherExists) {
          _role = 'follower';
          console.log('[TAB-LEADER] This tab is a follower');
        } else {
          console.log('[TAB-LEADER] No other tabs found — promoting to leader');
          forceLeader();
        }
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
