'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    content: '',
    tags: '',
    type: 'swap',
    isPublished: false,
    readTime: 5,
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then(res => res.json())
      .then(data => {
        setForm({
          title: data.title || '',
          description: data.description || '',
          content: data.content || '',
          tags: data.tags?.join(', ') || '',
          type: data.type || 'swap',
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
        const response = await fetch('/api/upload', {
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
        type: form.type,
        isPublished: form.isPublished,
        readTime: form.readTime || 5,
      };

      const response = await fetchWithCsrf(`/api/articles/${id}`, {
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

        {/* Тип контента */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Тип контента
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'swap' })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                form.type === 'swap'
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              Свапы
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'service' })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                form.type === 'service'
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              Услуги / Автосервис
            </button>
          </div>
        </div>

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
    </div>
  );
}