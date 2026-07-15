// frontend/components/admin/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Дашборд', href: '/admin' },
  { icon: ShoppingBag, label: 'Заказы', href: '/admin/orders' },
  { icon: Users, label: 'Пользователи', href: '/admin/users' },
  { icon: FileText, label: 'Контент', href: '/admin/content/articles' },
  { icon: Settings, label: 'Настройки', href: '/admin/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">SWAP</span>
          <span className="text-xl font-light text-gray-500">SERVICE</span>
          <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded">38</span>
        </Link>
        <p className="text-xs text-gray-400 mt-1">Административная панель</p>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => {
            fetch('/api/auth/logout', { method: 'POST' }).then(() =>
              window.location.href = '/login'
            );
          }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full"
        >
          <LogOut size={20} />
          Выйти
        </button>
      </div>
    </aside>
  );
}