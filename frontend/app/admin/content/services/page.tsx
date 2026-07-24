'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  AlertCircle,
  DollarSign,
  Wrench
} from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithCsrf('/api/admin/content/services', {
        method: 'GET',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка загрузки услуг');
      }

      const data = await response.json();
      setServices(data.services || []);
    } catch (err: any) {
      console.error('❌ Ошибка загрузки услуг:', err);
      setError(err.message || 'Ошибка загрузки услуг');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить услугу?')) return;

    try {
      const response = await fetchWithCsrf(`/api/admin/content/services/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchServices();
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      alert('Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Загрузка услуг...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Услуги</h1>
          <p className="text-sm text-muted-foreground">Управление услугами</p>
        </div>
        <Link
          href="/admin/content/services/create"
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" />
          Создать услугу
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
            <Wrench className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p>Услуг не найдено</p>
            <Link
              href="/admin/content/services/create"
              className="inline-block mt-4 text-sm text-foreground hover:underline"
            >
              Создать первую услугу
            </Link>
          </div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="bg-card border border-border rounded-2xl p-5 hover:border-foreground/30 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{service.name}</h3>
                  {service.price !== null && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <DollarSign className="w-3 h-3" />
                      {service.price.toLocaleString()} ₽
                    </p>
                  )}
                  {service.description && (
                    <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="mt-2">
                    {service.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                        Активна
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Неактивна
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => router.push(`/admin/content/services/${service.id}`)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}