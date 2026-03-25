/**
 * Collaboration Module (Phase 3)
 *
 * Provides:
 * - Yjs CRDT-based collaborative editing for notes and drawings
 * - Study group management (create, join, share resources)
 * - Local persistence via y-indexeddb
 * - Cloud persistence via Firestore
 */
export {
  getCollabDoc,
  getSharedText,
  getSharedDrawingElements,
  getAwareness,
  destroyCollabDoc,
  destroyAllCollabDocs,
  syncDocToFirestore,
  loadDocFromFirestore,
} from './yjsProvider';

export {
  createStudyGroup,
  joinStudyGroup,
  listMyGroups,
  type StudyGroup,
  type GroupMember,
  type GroupMessage,
} from './studyGroups';
