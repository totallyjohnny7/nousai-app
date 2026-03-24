/**
 * Study Groups — shared study spaces with collaborative resources.
 *
 * Firestore structure:
 *   groups/{groupId}/
 *     members/{uid} — { role: 'owner' | 'member', joinedAt, displayName }
 *     shared_notes/{noteId} — shared Yjs note (Yjs state blob)
 *     shared_drawings/{drawingId} — shared Yjs drawing
 *     shared_courses/{courseId} — shared course snapshot (read-only copy)
 *     chat/{messageId} — group chat messages
 *
 * Permissions:
 *   - Owner can invite/remove members, delete group
 *   - Members can read/write shared resources
 *   - Non-members cannot access anything
 */

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  inviteCode: string; // 6-char code for joining
  memberCount: number;
}

export interface GroupMember {
  uid: string;
  displayName: string;
  role: 'owner' | 'member';
  joinedAt: string;
  avatarEmoji?: string;
}

export interface GroupMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  timestamp: string;
}

/** Generate a 6-character invite code */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create a new study group.
 * The creating user becomes the owner.
 */
export async function createStudyGroup(
  name: string,
  description: string,
  uid: string,
  displayName: string,
  firestoreDb: any,
  fbFns: any,
): Promise<StudyGroup> {
  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const inviteCode = generateInviteCode();

  const group: StudyGroup = {
    id: groupId,
    name,
    description,
    ownerId: uid,
    createdAt: now,
    inviteCode,
    memberCount: 1,
  };

  // Create group document
  const groupRef = fbFns.doc(firestoreDb, 'groups', groupId);
  await fbFns.setDoc(groupRef, group);

  // Add owner as first member
  const memberRef = fbFns.doc(firestoreDb, 'groups', groupId, 'members', uid);
  await fbFns.setDoc(memberRef, {
    uid,
    displayName,
    role: 'owner',
    joinedAt: now,
  });

  console.log(`[GROUPS] Created group "${name}" (${groupId})`);
  return group;
}

/**
 * Join a study group using an invite code.
 */
export async function joinStudyGroup(
  inviteCode: string,
  uid: string,
  displayName: string,
  firestoreDb: any,
  fbFns: any,
): Promise<StudyGroup | null> {
  // Find group by invite code
  const groupsCol = fbFns.collection(firestoreDb, 'groups');
  const snap = await fbFns.getDocs(groupsCol);
  const groupDoc = snap.docs.find((d: any) => d.data().inviteCode === inviteCode);

  if (!groupDoc) {
    console.warn('[GROUPS] Invalid invite code:', inviteCode);
    return null;
  }

  const group = groupDoc.data() as StudyGroup;
  const now = new Date().toISOString();

  // Add as member
  const memberRef = fbFns.doc(firestoreDb, 'groups', group.id, 'members', uid);
  await fbFns.setDoc(memberRef, {
    uid,
    displayName,
    role: 'member',
    joinedAt: now,
  });

  // Increment member count
  await fbFns.setDoc(fbFns.doc(firestoreDb, 'groups', group.id), {
    memberCount: group.memberCount + 1,
  }, { merge: true });

  console.log(`[GROUPS] Joined group "${group.name}"`);
  return group;
}

/**
 * List groups the user is a member of.
 * Reads from the user's groups subcollection.
 */
export async function listMyGroups(
  uid: string,
  firestoreDb: any,
  fbFns: any,
): Promise<StudyGroup[]> {
  // This is a simplified implementation — in production you'd use a
  // collectionGroup query or maintain a groups list on the user document.
  // For now, we scan all groups (acceptable for small-scale use).
  try {
    const groupsCol = fbFns.collection(firestoreDb, 'groups');
    const allGroups = await fbFns.getDocs(groupsCol);
    const myGroups: StudyGroup[] = [];

    for (const doc of allGroups.docs) {
      const memberRef = fbFns.doc(firestoreDb, 'groups', doc.id, 'members', uid);
      try {
        const memberSnap = await fbFns.getDoc(memberRef);
        if (memberSnap.exists()) {
          myGroups.push(doc.data() as StudyGroup);
        }
      } catch { /* not a member */ }
    }

    return myGroups;
  } catch (e) {
    console.error('[GROUPS] Failed to list groups:', e);
    return [];
  }
}
