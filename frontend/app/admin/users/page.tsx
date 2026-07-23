'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Loader2,
  UserPlus,
  Ban,
  Unlock,
  Trash2,
  Edit,
  AlertCircle,
  Shield,
  Mail,
  Phone
} from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  role: 'user' | 'manager' | 'admin';
  isVerified: boolean;
  blockedAt: string | null;
  createdAt: string;
  _count?: { orders: number };
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-500',
  manager: 'bg-blue-500/20 text-blue-500',
  user: 'bg-gray-500/20 text-gray-400',
};

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  user: 'Пользователь',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  // ✅ ДЛЯ МАССОВЫХ ДЕЙСТВИЙ
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isMassAction, setIsMassAction] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockPassword, setBlockPassword] = useState('');
  const [blockAction, setBlockAction] = useState<'block' | 'unblock' | 'delete'>('block');
  const [blockTargetId, setBlockTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки пользователей');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setSelectedUsers(new Set());
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    fetchUsers();
  };

  // ✅ ЧЕКБОКСЫ
  const selectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedUsers(newSet);
  };

  // ✅ БЛОКИРОВКА/РАЗБЛОКИРОВКА С ПАРОЛЕМ
  const handleToggleBlock = async (user: User) => {
    const action = user.blockedAt ? 'разблокировать' : 'заблокировать';
    if (!confirm(`${action} пользователя ${user.email}?`)) return;

    setActionLoading(user.id);
    try {
      const url = user.blockedAt
        ? `/api/admin/users/${user.id}/unblock`
        : `/api/admin/users/${user.id}/block`;
      
      const response = await fetchWithCsrf(url, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка');
      }
    } catch (error) {
      alert('Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ УДАЛЕНИЕ С ПАРОЛЕМ
  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить пользователя ${user.email}? Это действие нельзя отменить.`)) return;
    if (!confirm('Вы уверены?')) return;

    setActionLoading(user.id);
    try {
      const response = await fetchWithCsrf(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      alert('Ошибка удаления');
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ МАССОВОЕ УДАЛЕНИЕ
  const handleMassDelete = async () => {
    if (selectedUsers.size === 0) return;
    if (!confirm(`Удалить ${selectedUsers.size} пользователей? Это действие нельзя отменить.`)) return;
    if (!confirm('Вы уверены?')) return;

    setIsMassAction(true);
    try {
      const ids = Array.from(selectedUsers);
      const response = await fetchWithCsrf('/api/admin/users/mass-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });

      if (response.ok) {
        setSelectedUsers(new Set());
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка массового удаления');
      }
    } catch (error) {
      alert('Ошибка массового удаления');
    } finally {
      setIsMassAction(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка пользователей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Пользователи</h1>
          <p className="text-sm text-muted-foreground">Управление пользователями</p>
        </div>
        <Link
          href="/admin/users/create"
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition"
        >
          <UserPlus className="w-4 h-4" />
          Создать
        </Link>
      </div>

      {/* Поиск */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Поиск по email или имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition"
        >
          Найти
        </button>
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="p-2 text-muted-foreground hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Таблица */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-border bg-muted text-foreground focus:ring-foreground/20"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Контакты
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Роль
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Заказы
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Пользователей не найдено
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="w-4 h-4 rounded border-border bg-muted text-foreground focus:ring-foreground/20"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : 'Без имени'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.phone && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {user.phone}
                        </div>
                      )}
                      {!user.phone && (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${roleColors[user.role] || 'bg-muted text-muted-foreground'}`}>
                        {roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.blockedAt ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-500">
                          Заблокирован
                        </span>
                      ) : !user.isVerified ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                          Не подтверждён
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                          Активен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {user._count?.orders || 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleBlock(user)}
                          disabled={actionLoading === user.id}
                          className="p-2 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition disabled:opacity-50"
                          title={user.blockedAt ? 'Разблокировать' : 'Заблокировать'}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : user.blockedAt ? (
                            <Unlock className="w-4 h-4" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => router.push(`/admin/users/${user.id}`)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={actionLoading === user.id}
                          className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground">
              Показано {users.length} из {total} пользователей
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm text-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ ПАНЕЛЬ МАССОВЫХ ДЕЙСТВИЙ */}
      {selectedUsers.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm text-foreground font-medium">
            Выбрано: {selectedUsers.size}
          </span>
          <button
            onClick={handleMassDelete}
            disabled={isMassAction}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isMassAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Удалить выбранные
          </button>
          <button
            onClick={() => setSelectedUsers(new Set())}
            className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition"
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}