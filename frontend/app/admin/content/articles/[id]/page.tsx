'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ImageUpload } from '@/components/admin/content/ImageUpload';

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
    isPublished: false,
    readTime: 5,
  });
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then(res => res.json())
      .then(data => {
        console.log('📥 Данные статьи:', data);
        setForm({
          title: data.title || '',
          description: data.description || '',
          content: data.content || '',
          tags: data.tags?.join(', ') || '',
          isPublished: data.isPublished || false,
          readTime: data.readTime || 5,
        });
        setImages(data.images || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ Ошибка загрузки:', err);
        setLoading(false);
      });
  }, [id]);

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
        images: images.map(url => ({ 
          url, 
          filename: url.split('/').pop() || 'image.jpg',
          isMain: false,
        })),
        isPublished: form.isPublished,
        readTime: form.readTime || 5,
      };

      console.log('📤 Обновление:', payload);

      const response = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    return <div className="flex items-center justify-center h-64 text-gray-500">Загрузка...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Редактирование статьи</h1>
          <p className="text-sm text-gray-500">{form.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Заголовок */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Описание */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Краткое описание</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Теги */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Теги (через запятую)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Время чтения */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Время чтения (мин)</label>
          <input
            type="number"
            value={form.readTime}
            onChange={(e) => setForm({ ...form, readTime: parseInt(e.target.value) || 5 })}
            className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            min={1}
          />
        </div>

        {/* Изображения */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Фотографии</label>
          <ImageUpload images={images} onChange={setImages} maxCount={10} />
        </div>

        {/* Содержание */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Содержание *</label>
          <textarea
            required
            rows={12}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Поддерживается HTML-разметка</p>
        </div>

        {/* Опубликовать */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label className="text-sm text-gray-700">Опубликовано</label>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}