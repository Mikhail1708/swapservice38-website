'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertCircle, Shield, Globe, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { fetchWithCsrf }  from '@/lib/csrf';

interface Settings {
  siteName: string;
  siteDescription: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  workingHours: string;
  maintenanceMode: string;
  maintenanceMessage: string;
}

const defaultSettings: Settings = {
  siteName: 'SWAP SERVICE 38',
  siteDescription: 'Тюнинг и обслуживание внедорожников',
  contactPhone: '+7 (914) 895-58-88',
  contactEmail: 'swapservice38@yandex.ru',
  contactAddress: 'г. Иркутск, ул. Новаторов 36',
  workingHours: 'Ежедневно с 10:00 до 20:00',
  maintenanceMode: 'false',
  maintenanceMessage: 'Сайт на техническом обслуживании. Приносим извинения за неудобства.',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Загрузка настроек
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setSettings({ ...defaultSettings, ...data });
        }
      } catch (err) {
        console.error('Ошибка загрузки настроек:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithCsrf('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Настройки успешно сохранены');
        // Если включили режим обслуживания — показываем предупреждение
        if (settings.maintenanceMode === 'true') {
          setTimeout(() => {
            alert('🔧 Включён режим обслуживания! Обычные пользователи увидят страницу "Идут технические работы".');
          }, 500);
        }
      } else {
        setError(data.error || 'Ошибка сохранения настроек');
      }
    } catch (err) {
      setError('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Сбросить все настройки к значениям по умолчанию?')) return;
    setSettings(defaultSettings);
    alert('✅ Настройки сброшены. Не забудьте сохранить.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-sm text-muted-foreground">Управление настройками сайта</p>
      </div>

      {/* Уведомления */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основные настройки */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-muted-foreground" />
              Основные настройки
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Название сайта
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => handleChange('siteName', e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Описание сайта
                </label>
                <input
                  type="text"
                  value={settings.siteDescription}
                  onChange={(e) => handleChange('siteDescription', e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    <Phone className="w-4 h-4 inline mr-1 text-muted-foreground" />
                    Телефон
                  </label>
                  <input
                    type="text"
                    value={settings.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    <Mail className="w-4 h-4 inline mr-1 text-muted-foreground" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <MapPin className="w-4 h-4 inline mr-1 text-muted-foreground" />
                  Адрес
                </label>
                <input
                  type="text"
                  value={settings.contactAddress}
                  onChange={(e) => handleChange('contactAddress', e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Clock className="w-4 h-4 inline mr-1 text-muted-foreground" />
                  Режим работы
                </label>
                <input
                  type="text"
                  value={settings.workingHours}
                  onChange={(e) => handleChange('workingHours', e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                />
              </div>

              {/* Сообщение для режима обслуживания */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Shield className="w-4 h-4 inline mr-1 text-muted-foreground" />
                  Сообщение в режиме обслуживания
                </label>
                <textarea
                  value={settings.maintenanceMessage}
                  onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
                  placeholder="Сообщение, которое увидят пользователи при включённом режиме обслуживания"
                />
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Это сообщение увидят все пользователи, кроме администраторов, когда включён режим обслуживания.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
            </form>
          </div>
        </div>

        {/* Боковая панель */}
        <div className="space-y-4">
          {/* Дополнительные настройки */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Дополнительно</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Режим обслуживания</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode === 'true'}
                    onChange={(e) => handleChange('maintenanceMode', e.target.checked ? 'true' : 'false')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </label>
              </div>
              {settings.maintenanceMode === 'true' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500">
                  ⚠️ Режим обслуживания включён. Обычные пользователи не смогут зайти на сайт.
                </div>
              )}
            </div>
          </div>

          {/* Действия */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Действия</h3>
            <div className="space-y-2">
              <button
                onClick={handleResetSettings}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-red-500/10 rounded-lg text-sm text-red-500 hover:bg-red-500/20 transition"
              >
                <AlertCircle className="w-4 h-4" />
                Сбросить настройки
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
