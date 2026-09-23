'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from '@/lib/next-shims';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchService = async () => {
      try {
        
        const response = await fetchWithCsrf(`/api/admin/content/services/${id}`, {
          method: 'GET',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Ошибка загрузки услуги');
        }

        const data = await response.json();
        
        const service = data.service;
        setForm({
          name: service.name || '',
          description: service.description || '',
          isActive: service.isActive ?? true,
        });
        if (service.imageUrl) {
          setImageUrls([service.imageUrl]);
        }
      } catch (error: any) {
        console.error('❌ Ошибка загрузки:', error);
        setError(error.message || 'Ошибка загрузки услуги');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchService();
    }
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

  const removeImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
        isActive: form.isActive,
      };


      const response = await fetchWithCsrf(`/api/admin/content/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/admin/content/services');
      } else {
        setError(data.error || 'Ошибка обновления');
      }
    } catch (error: any) {
      console.error('❌ Ошибка:', error);
      setError(error.message || 'Ошибка обновления');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => router.push('/admin/content/services')}
          className="mt-4 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition"
        >
          Вернуться к услугам
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Редактирование услуги</h1>
          <p className="text-sm text-muted-foreground">{form.name || 'Новая услуга'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
            placeholder="Например: Установка дроп-китов"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Описание
          </label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
            placeholder="Подробное описание услуги"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Изображение
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
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-foreground"></div>
          </label>
          <span className="text-sm text-foreground">Активна</span>
        </div>

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
