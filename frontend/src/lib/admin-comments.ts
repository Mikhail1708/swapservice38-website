// Match Comment.parentId ON DELETE SET NULL without removing surviving replies.
export function removeDeletedComment<T extends { id: string; parentId?: string | null }>(comments: T[], id: string): T[] {
  return comments.filter(comment => comment.id !== id)
    .map(comment => comment.parentId === id ? { ...comment, parentId: null } : comment);
}
