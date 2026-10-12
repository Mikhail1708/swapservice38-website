
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter, Link } from '@/lib/next-shims';
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
  User,
  Home,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

const menuItems = [
  {
    icon: LayoutDashboard,
    label: 'Дашборд',
    href: '/admin',
  },
  {
    icon: ShoppingBag,
    label: 'Заказы',
    href: '/admin/orders',
  },
  {
    icon: Users,
    label: 'Пользователи',
    href: '/admin/users',
    adminOnly: true,
  },
  {
    icon: FileText,
    label: 'Контент',
    href: '/admin/content/articles',
    subItems: [
      { label: 'Статьи', href: '/admin/content/articles' },
      { label: 'Новости', href: '/admin/content/news' },
      { label: 'Услуги', href: '/admin/content/services' },
    ],
  },
  {
    icon: Settings,
    label: 'Настройки',
    href: '/admin/settings',
  },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<
    Record<string, boolean>
  >({});

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  // On mobile, always display the full sidebar content.
  // On desktop, respect the collapsed/expanded state.
  const isMenuExpanded = isSidebarOpen || isMobileMenuOpen;

  const isContentRoute = pathname.startsWith('/admin/content/');

  // Access control
  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace(
        `/login?redirect=${encodeURIComponent(pathname)}`
      );
      return;
    }

    if (!['admin', 'manager'].includes(user.role)) {
      router.replace('/');
      return;
    }

    if (
      user.role === 'manager' &&
      pathname.startsWith('/admin/users')
    ) {
      router.replace('/admin');
    }
  }, [user, isLoading, pathname, router]);

  // Set initial desktop/mobile layout and respond to resizing.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
        setIsMobileMenuOpen(false);
      } else {
        setIsSidebarOpen(true);
        setIsMobileMenuOpen(false);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Close the mobile drawer when navigating.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Escape closes the drawer, and background scrolling is locked.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const toggleMenu = (href: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [href]: !(prev[href] ?? isContentRoute),
    }));
  };

  const handleNavigate = (href: string) => {
    setIsMobileMenuOpen(false);

    if (pathname !== href) {
      router.push(href);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMobileMenuOpen(false);
      router.replace('/');
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Не удалось выйти'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!user || !['admin', 'manager'].includes(user.role) ||
      (user.role === 'manager' && pathname.startsWith('/admin/users'))) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Закрыть боковое меню"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        aria-label="Навигация администратора"
        className={`
          fixed left-0 top-0 z-50
          h-dvh w-64 max-w-[85vw]
          border-r border-border bg-card
          transition-transform duration-300 ease-in-out
          lg:max-w-none lg:transition-all
          ${isSidebarOpen ? 'lg:w-64' : 'lg:w-20'}
          ${
            isMobileMenuOpen
              ? 'translate-x-0 visible'
              : '-translate-x-full invisible lg:visible lg:translate-x-0'
          }
        `}
      >
        <div
          className={`
            flex h-full min-h-0 flex-col overflow-hidden
            ${isMenuExpanded ? 'p-4' : 'p-2'}
          `}
        >
          {/* Logo and mobile close button */}
          <div
            className={`
              mb-6 flex min-h-10 items-center gap-2
              ${isMenuExpanded ? 'justify-between' : 'justify-center'}
            `}
          >
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex min-w-0 items-center"
              aria-label="SWAPSERVICE38 — дашборд"
            >
              <span
                className={`
                  heading-display whitespace-nowrap text-foreground
                  ${isMenuExpanded ? 'text-lg' : 'text-sm'}
                `}
              >
                {isMenuExpanded ? 'SWAPSERVICE38' : 'SWAP'}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Закрыть меню"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="space-y-1">
              {menuItems
                .filter(
                  (item) =>
                    !item.adminOnly || user.role === 'admin'
                )
                .map((item) => {
                  const hasSubItems =
                    Boolean(item.subItems?.length);

                  const isActive =
                    pathname === item.href ||
                    (item.href === '/admin'
                      ? false
                      : hasSubItems
                        ? isContentRoute
                        : pathname.startsWith(item.href + '/'));

                  const isExpanded =
                    expandedMenus[item.href] ??
                    (hasSubItems && isContentRoute);

                  const Icon = item.icon;

                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        title={
                          isMenuExpanded
                            ? undefined
                            : item.label
                        }
                        aria-label={item.label}
                        aria-current={
                          isActive && !hasSubItems
                            ? 'page'
                            : undefined
                        }
                        aria-expanded={
                          hasSubItems
                            ? Boolean(isExpanded && isMenuExpanded)
                            : undefined
                        }
                        onClick={() => {
                          if (hasSubItems) {
                            // Expand the desktop sidebar first,
                            // then reveal the submenu.
                            if (
                              !isMenuExpanded &&
                              window.innerWidth >= 1024
                            ) {
                              setIsSidebarOpen(true);
                              setExpandedMenus((prev) => ({
                                ...prev,
                                [item.href]: true,
                              }));
                            } else {
                              toggleMenu(item.href);
                            }
                          } else {
                            handleNavigate(item.href);
                          }
                        }}
                        className={`
                          flex min-h-11 w-full items-center gap-3
                          rounded-lg px-3 py-2.5
                          text-left text-sm font-medium
                          transition-colors
                          ${
                            isActive
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }
                          ${
                            !isMenuExpanded
                              ? 'justify-center'
                              : ''
                          }
                        `}
                      >
                        <Icon
                          className={`
                            shrink-0
                            ${
                              isMenuExpanded
                                ? 'h-5 w-5'
                                : 'h-6 w-6'
                            }
                          `}
                        />

                        {isMenuExpanded && (
                          <>
                            <span className="min-w-0 flex-1">
                              {item.label}
                            </span>

                            {hasSubItems && (
                              <ChevronDown
                                className={`
                                  h-4 w-4 shrink-0
                                  transition-transform
                                  ${
                                    isExpanded
                                      ? 'rotate-180'
                                      : ''
                                  }
                                `}
                              />
                            )}
                          </>
                        )}
                      </button>

                      {/* Submenu */}
                      {hasSubItems &&
                        isMenuExpanded &&
                        isExpanded && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.subItems?.map((subItem) => {
                              const isSubActive =
                                pathname === subItem.href;

                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  onClick={() =>
                                    setIsMobileMenuOpen(false)
                                  }
                                  aria-current={
                                    isSubActive
                                      ? 'page'
                                      : undefined
                                  }
                                  className={`
                                    block rounded-lg
                                    px-3 py-2.5 text-sm
                                    transition-colors
                                    ${
                                      isSubActive
                                        ? 'bg-foreground/10 text-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }
                                  `}
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

          {/* Logout */}
          <div className="mt-4 shrink-0 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Выйти из аккаунта"
              title={
                isMenuExpanded ? undefined : 'Выйти'
              }
              className={`
                flex min-h-11 w-full items-center gap-3
                rounded-lg px-3 py-2.5
                text-sm font-medium text-red-500
                transition-colors hover:bg-red-500/10
                ${
                  !isMenuExpanded
                    ? 'justify-center'
                    : ''
                }
              `}
            >
              <LogOut
                className={`
                  shrink-0
                  ${
                    isMenuExpanded
                      ? 'h-5 w-5'
                      : 'h-6 w-6'
                  }
                `}
              />

              {isMenuExpanded && <span>Выйти</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`
          min-w-0 transition-none lg:transition-[margin-left] lg:duration-300
          ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
        `}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() =>
                  setIsMobileMenuOpen((prev) => !prev)
                }
                aria-label={
                  isMobileMenuOpen
                    ? 'Закрыть меню'
                    : 'Открыть меню'
                }
                aria-expanded={isMobileMenuOpen}
                aria-controls="admin-sidebar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-muted lg:hidden"
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>

              {/* Desktop collapse button */}
              <button
                type="button"
                onClick={() =>
                  setIsSidebarOpen((prev) => !prev)
                }
                aria-label={
                  isSidebarOpen
                    ? 'Свернуть панель'
                    : 'Развернуть панель'
                }
                aria-expanded={isSidebarOpen}
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-muted lg:flex"
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>

              <h2 className="hidden truncate text-sm font-medium text-foreground sm:block">
                {menuItems.find((item) =>
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/')
                )?.label || 'Админ-панель'}
              </h2>
            </div>

            {/* Right-side actions */}
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <Link
                href="/"
                className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                aria-label="Перейти на сайт"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">
                  На сайт
                </span>
              </Link>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                  <User className="h-4 w-4 text-foreground" />
                </div>

                <span className="hidden text-sm text-foreground sm:inline">
                  {user.firstName || 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
