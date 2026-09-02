'use client';

import { useState } from 'react';
import { useRouter } from '@/lib/next-shims';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';

export default function CreateNewsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    imageUrl: '',
    isPublished: false,
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const removeImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...form,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : '',
        images: imageUrls.map((url, index) => ({ url, sortOrder: index, isMain: index === 0 })),
        type: 'news',
      };

      const response = await fetchWithCsrf('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push('/admin/content/news');
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка создания новости');
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка создания новости');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Создание новости</h1>
          <p className="text-sm text-muted-foreground">Добавьте новую новость</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Содержание <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={8}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Изображения
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
          </div>
          <p className="text-xs text-muted-foreground/60">Первое изображение будет использовано как обложка</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-foreground"></div>
          </label>
          <span className="text-sm text-foreground">Опубликовать сразу</span>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Сохранение...' : 'Сохранить'}
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
