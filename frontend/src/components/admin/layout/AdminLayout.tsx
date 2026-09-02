'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter, Image, Link } from '@/lib/next-shims';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Package,
  Calendar,
  BarChart3,
  User,
  Home
} from 'lucide-react';
import { useAuth }  from '@/lib/hooks/useAuth';

const menuItems = [
  { icon: LayoutDashboard, label: 'Дашборд', href: '/admin' },
  { icon: ShoppingBag, label: 'Заказы', href: '/admin/orders' },
  { icon: Users, label: 'Пользователи', href: '/admin/users', adminOnly: true },
  { 
    icon: FileText, 
    label: 'Контент', 
    href: '/admin/content/articles',
    subItems: [
      { label: 'Статьи', href: '/admin/content/articles' },
      { label: 'Новости', href: '/admin/content/news' },
      { label: 'Услуги', href: '/admin/content/services' },
    ]
  },
  { icon: Settings, label: 'Настройки', href: '/admin/settings' },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  // Проверяем права доступа
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (!isLoading && user && !['admin', 'manager'].includes(user.role)) {
      router.replace('/');
    } else if (!isLoading && user?.role === 'manager' && pathname.startsWith('/admin/users')) {
      router.replace('/admin');
    }
  }, [user, isLoading, pathname, router]);

  const toggleMenu = (href: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [href]: !prev[href]
    }));
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось выйти');
    }
  };

  // Адаптивная ширина
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
        setIsMobileMenuOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !['admin', 'manager'].includes(user.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ===== МОБИЛЬНЫЙ ОВЕРЛЕЙ ===== */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ===== САЙДБАР ===== */}
      <aside
        className={`fixed left-0 top-0 h-full z-50 bg-card border-r border-border transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-0 lg:w-20'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`${isSidebarOpen ? 'p-4' : 'p-2'} h-full flex flex-col overflow-hidden`}>
          {/* Логотип */}
          <div className={`flex items-center gap-2 ${isSidebarOpen ? 'mb-6' : 'mb-4 justify-center'}`}>
            <Link href="/admin" className="flex items-center gap-2">
              <span className={`heading-display ${isSidebarOpen ? 'text-lg' : 'text-base'} text-foreground`}>
                {isSidebarOpen ? 'SWAP SERVICE 38' : 'SS'}
              </span>
            </Link>
          </div>

          {/* Навигация */}
          <nav className="flex-1 overflow-y-auto">
            <div className="space-y-1">
              {menuItems.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                const isExpanded = expandedMenus[item.href] || false;
                const hasSubItems = item.subItems && item.subItems.length > 0;

                return (
                  <div key={item.href}>
                    {/* Основной пункт меню */}
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      } ${!isSidebarOpen && 'justify-center'}`}
                      onClick={() => {
                        if (hasSubItems) {
                          toggleMenu(item.href);
                        } else {
                          router.push(item.href);
                          setIsMobileMenuOpen(false);
                        }
                      }}
                    >
                      <item.icon className={`${isSidebarOpen ? 'w-5 h-5' : 'w-6 h-6'}`} />
                      {isSidebarOpen && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {hasSubItems && (
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Подменю */}
                    {hasSubItems && isSidebarOpen && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.subItems.map((subItem) => {
                          const isSubActive = pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={`block px-3 py-2 rounded-lg text-sm transition ${
                                isSubActive
                                  ? 'bg-foreground/10 text-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              }`}
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {subItem.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Выход */}
          <div className="border-t border-border pt-4">
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition ${
                !isSidebarOpen && 'justify-center'
              }`}
            >
              <LogOut className={isSidebarOpen ? 'w-5 h-5' : 'w-6 h-6'} />
              {isSidebarOpen && <span>Выйти</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ===== ОСНОВНАЯ ЧАСТЬ ===== */}
      <div className={`transition-all duration-300 ${
        isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        {/* ===== ТОП-БАР ===== */}
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden lg:flex p-2 rounded-lg hover:bg-muted transition"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-sm font-medium text-foreground hidden sm:block">
                {menuItems.find(item => pathname === item.href || pathname?.startsWith(item.href + '/'))?.label || 'Админ-панель'}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">На сайт</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-sm text-foreground hidden sm:inline">
                  {user?.firstName || 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ===== КОНТЕНТ ===== */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
