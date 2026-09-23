'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from '@/lib/next-shims';
import { ArrowLeft, Loader2, Plus, X, Trash2 } from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';
import { useAuth } from '@/lib/hooks/useAuth';
import { removeDeletedComment } from '@/lib/admin-comments';

interface AdminComment {
  id: string;
  author: string;
  authorId: string;
  createdAt: string;
  content: string;
  parentId?: string | null;
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    content: '',
    tags: '',
    isPublished: false,
    readTime: 5,
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [deletingComment, setDeletingComment] = useState<AdminComment | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const deleteInFlight = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const commentsRequest = useRef<AbortController | null>(null);

  const loadComments = async (cursor?: string) => {
    commentsRequest.current?.abort();
    const controller = new AbortController();
    commentsRequest.current = controller;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const query = cursor ? `?after=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(`/api/admin/articles/${id}/comments${query}`, {
        credentials: 'include', signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить комментарии');
      if (controller.signal.aborted) return;
      setComments(current => cursor ? [...current, ...data.comments] : data.comments);
      setCommentsCursor(data.nextCursor);
    } catch (error) {
      if (!controller.signal.aborted) setCommentsError(error instanceof Error ? error.message : 'Не удалось загрузить комментарии');
    } finally {
      if (!controller.signal.aborted) setCommentsLoading(false);
    }
  };

  useEffect(() => {
    setComments([]);
    setCommentsCursor(null);
    if (user?.role === 'admin') void loadComments();
    return () => commentsRequest.current?.abort();
  }, [id, user?.role]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (deletingComment && dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, [deletingComment]);

  useEffect(() => {
    fetch(`/api/admin/articles/${id}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки статьи');
        return data;
      })
      .then(data => {
        setForm({
          title: data.title || '',
          description: data.description || '',
          content: data.content || '',
          tags: data.tags?.join(', ') || '',
          isPublished: data.isPublished || false,
          readTime: data.readTime || 5,
        });
        setImageUrls(data.images || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ Ошибка загрузки:', err);
        setLoading(false);
      });
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetchWithCsrf('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            uploadedUrls.push(data.url);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
      }
    }

    setImageUrls([...imageUrls, ...uploadedUrls]);
    setUploading(false);
    e.target.value = '';
  };

  const handleDeleteComment = async () => {
    if (deleteInFlight.current || user?.role !== 'admin') return;
    const reason = deleteReason.trim();
    if (!deletingComment || !reason || reason.length > 2000) {
      setDeleteError('Укажите причину удаления');
      return;
    }
    deleteInFlight.current = true;
    setDeletePending(true);
    setDeleteError(null);
    const commentId = deletingComment.id;
    try {
      const response = await fetchWithCsrf(`/api/admin/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось удалить комментарий');
      commentsRequest.current?.abort();
      setCommentsLoading(false);
      setComments((current) => removeDeletedComment(current, commentId));
      setDeletingComment(null);
      setDeleteReason('');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Не удалось удалить комментарий');
    } finally {
      deleteInFlight.current = false;
      setDeletePending(false);
    }
  };

  const renderComment = (comment: AdminComment): React.ReactNode => (
    <div key={comment.id} className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{comment.author || 'Аноним'}</p>
          <p className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString('ru-RU')}</p>
        </div>
        {user?.role === 'admin' && (
          <button type="button" onClick={() => { setDeletingComment(comment); setDeleteReason(''); setDeleteError(null); }} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" /> Удалить
          </button>
        )}
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap [overflow-wrap:anywhere]">{comment.content}</p>
      {comment.parentId && <p className="text-xs text-muted-foreground">Ответ на комментарий</p>}
    </div>
  );

  const removeImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const tagsArray = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || form.title.trim(),
        content: form.content,
        tags: tagsArray,
        images: imageUrls.map(url => ({ 
          url, 
          filename: url.split('/').pop() || 'image.jpg',
          isMain: false,
        })),
        type: 'swap', // ✅ ТОЛЬКО СВАПЫ
        isPublished: form.isPublished,
        readTime: form.readTime || 5,
      };

      const response = await fetchWithCsrf(`/api/admin/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        router.push('/admin/content/articles');
      } else {
        alert(result.error || 'Ошибка обновления');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert('Ошибка обновления статьи');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Редактирование статьи</h1>
          <p className="text-sm text-muted-foreground">{form.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-6">
        {/* Заголовок */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Заголовок <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
          />
        </div>

        {/* ✅ УБРАН ВЫБОР ТИПА — только свапы */}

        {/* Описание */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Краткое описание
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
          />
        </div>

        {/* Теги */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Теги (через запятую)
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
          />
        </div>

        {/* Время чтения */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Время чтения (мин)
          </label>
          <input
            type="number"
            value={form.readTime}
            onChange={(e) => setForm({ ...form, readTime: parseInt(e.target.value) || 5 })}
            className="w-32 px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
            min={1}
          />
        </div>

        {/* Изображения */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Фотографии
          </label>
          <div className="flex flex-wrap gap-3 mb-3">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden group">
                <img src={url} alt={`Фото ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {imageUrls.length < 10 && (
              <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-foreground/30 transition">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Загрузить</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* Содержание */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Содержание <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={12}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground/60 mt-1">Поддерживается HTML-разметка</p>
        </div>

        {/* Опубликовать */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-foreground"></div>
          </label>
          <span className="text-sm text-foreground">Опубликовано</span>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            Отмена
          </button>
        </div>
      </form>
      {user?.role === 'admin' && <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Комментарии</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Комментариев нет</p>
        ) : (
          <div className="space-y-3">{comments.map((comment) => renderComment(comment))}</div>
        )}
        {commentsError && <p role="alert" className="text-sm text-red-500">{commentsError}</p>}
        {(commentsCursor || commentsError) && <button type="button" disabled={commentsLoading} onClick={() => void loadComments(commentsCursor || undefined)} className="text-sm underline disabled:opacity-50">{commentsLoading ? 'Загрузка...' : 'Загрузить комментарии'}</button>}
        {commentsLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
      </section>}

      {deletingComment && user?.role === 'admin' && (
        <dialog ref={dialogRef} onCancel={(event) => { if (deleteInFlight.current) event.preventDefault(); else setDeletingComment(null); }} className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 backdrop:bg-black/60" aria-labelledby="delete-comment-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 id="delete-comment-title" className="text-lg font-semibold text-foreground">Удалить комментарий?</h2>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Комментарий автора: «{Array.from(deletingComment.content).slice(0, 180).join('')}»</p>
            <label className="block text-sm font-medium text-foreground">
              Причина удаления
              <textarea
                autoFocus
                required
                maxLength={2000}
                disabled={deletePending}
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                className="mt-2 w-full min-h-24 rounded-lg border border-border bg-muted p-3 text-sm text-foreground focus:outline-none focus:border-foreground/40"
              />
            </label>
            {deleteError && <p role="alert" className="text-sm text-red-500">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={deletePending} onClick={() => { if (!deleteInFlight.current) setDeletingComment(null); }} className="rounded-lg border border-border px-4 py-2 text-sm">Отмена</button>
              <button type="button" onClick={handleDeleteComment} disabled={deletePending || !deleteReason.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">{deletePending ? 'Удаление...' : 'Удалить'}</button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
