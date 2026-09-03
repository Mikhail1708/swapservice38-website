// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'
import { EmailVerificationBanner } from '@/components/email-verification-banner'

// ============================================================
// ПУБЛИЧНЫЕ СТРАНИЦЫ
// ============================================================
import HomePage from '@/app/page'
import CatalogPage from '@/app/(public)/catalog/page'
import ProductPage from '@/app/(public)/catalog/[id]/page'
import CartPage from '@/app/(public)/cart/page'
import ContactsPage from '@/app/(public)/contacts/page'
import ServicesPage from '@/app/(public)/services/page'
import ServiceDetailPage from '@/app/(public)/services/[id]/page'
import SwapsPage from '@/app/(public)/swaps/page'
import SwapDetailPage from '@/app/(public)/swaps/[id]/page'
import OfferPage from '@/app/(public)/offer/page'
import PrivacyPage from '@/app/(public)/privacy/page'
import PaymentSuccessPage from '@/app/(public)/payment/success/page'
import PaymentFailPage from '@/app/(public)/payment/fail/page'
import PaymentPage from '@/app/(public)/payment/[orderId]/page'

// ============================================================
// СТРАНИЦЫ АВТОРИЗАЦИИ (AUTH) — БЕЗ ХЕДЕРА
// ============================================================
import LoginPage from '@/app/(auth)/login/page'
import RegisterPage from '@/app/(auth)/register/page'
import VerifyPage from '@/app/(auth)/verify/page'
import ResetPasswordPage from '@/app/(auth)/reset-password/page'
import ResetPasswordNewPage from '@/app/(auth)/reset-password/new/page'
import ResetPasswordVerifyPage from '@/app/(auth)/reset-password/verify/page'
import OAuthCallbackPage from '@/app/(auth)/oauth-callback/page'
import OAuthSuccessPage from '@/app/(auth)/oauth-success/page'

// ============================================================
// ПРОФИЛЬ — С ХЕДЕРОМ И ФУТЕРОМ!
// ============================================================
import ProfilePage from '@/app/(auth)/profile/page'
import ChangePasswordPage from '@/app/(auth)/profile/change-password/page'
import OrdersPage from '@/app/(auth)/profile/orders/page'
import OrderDetailPage from '@/app/(auth)/profile/orders/details/page'

// ============================================================
// АДМИН-ПАНЕЛЬ
// ============================================================
import AdminDashboardPage from '@/app/admin/page'
import AdminOrdersPage from '@/app/admin/orders/page'
import AdminOrderDetailPage from '@/app/admin/orders/[id]/page'
import AdminUsersPage from '@/app/admin/users/page'
import AdminCreateUserPage from '@/app/admin/users/create/page'
import AdminEditUserPage from '@/app/admin/users/[id]/page'
import AdminSettingsPage from '@/app/admin/settings/page'
import AdminArticlesPage from '@/app/admin/content/articles/page'
import AdminCreateArticlePage from '@/app/admin/content/articles/create/page'
import AdminEditArticlePage from '@/app/admin/content/articles/[id]/page'
import AdminNewsPage from '@/app/admin/content/news/page'
import AdminCreateNewsPage from '@/app/admin/content/news/create/page'
import AdminEditNewsPage from '@/app/admin/content/news/[id]/page'
import AdminServicesPage from '@/app/admin/content/services/page'
import AdminCreateServicePage from '@/app/admin/content/services/create/page'
import AdminEditServicePage from '@/app/admin/content/services/[id]/page'
import NotFoundPage from '@/app/not-found'

// ============================================================
// КОМПОНЕНТ-ОБЁРТКА ДЛЯ СТРАНИЦ С ХЕДЕРОМ И ФУТЕРОМ
// ============================================================
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-lg">
        Перейти к содержимому
      </a>
      <SiteHeader />
      <EmailVerificationBanner />
      <main id="main-content" tabIndex={-1} className="min-h-screen">{children}</main>
      <SiteFooter />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ===== ПУБЛИЧНЫЕ С ХЕДЕРОМ И ФУТЕРОМ ===== */}
        <Route path="/" element={<PageLayout><HomePage /></PageLayout>} />
        <Route path="/catalog" element={<PageLayout><CatalogPage /></PageLayout>} />
        <Route path="/catalog/:id" element={<PageLayout><ProductPage /></PageLayout>} />
        <Route path="/cart" element={<PageLayout><CartPage /></PageLayout>} />
        <Route path="/contacts" element={<PageLayout><ContactsPage /></PageLayout>} />
        <Route path="/services" element={<PageLayout><ServicesPage /></PageLayout>} />
        <Route path="/services/:id" element={<PageLayout><ServiceDetailPage /></PageLayout>} />
        <Route path="/swaps" element={<PageLayout><SwapsPage /></PageLayout>} />
        <Route path="/swaps/:id" element={<PageLayout><SwapDetailPage /></PageLayout>} />
        <Route path="/offer" element={<PageLayout><OfferPage /></PageLayout>} />
        <Route path="/privacy" element={<PageLayout><PrivacyPage /></PageLayout>} />
        <Route path="/payment/success" element={<PageLayout><PaymentSuccessPage /></PageLayout>} />
        <Route path="/payment/fail" element={<PageLayout><PaymentFailPage /></PageLayout>} />
        <Route path="/payment/:orderId" element={<PageLayout><PaymentPage /></PageLayout>} />

        {/* ===== ПРОФИЛЬ — ТОЖЕ С ХЕДЕРОМ И ФУТЕРОМ! ===== */}
        <Route path="/profile" element={<PageLayout><ProfilePage /></PageLayout>} />
        <Route path="/profile/change-password" element={<PageLayout><ChangePasswordPage /></PageLayout>} />
        <Route path="/profile/orders" element={<PageLayout><OrdersPage /></PageLayout>} />
        <Route path="/profile/orders/details" element={<PageLayout><OrderDetailPage /></PageLayout>} />

        {/* ===== АВТОРИЗАЦИЯ — БЕЗ ХЕДЕРА (полноэкранные) ===== */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password/new" element={<ResetPasswordNewPage />} />
        <Route path="/reset-password/verify" element={<ResetPasswordVerifyPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
        <Route path="/oauth-success" element={<OAuthSuccessPage />} />

        {/* ===== АДМИНКА — С АДМИН-ЛЕЙАУТОМ ===== */}
        <Route path="/admin" element={<AdminLayout><AdminDashboardPage /></AdminLayout>} />
        <Route path="/admin/orders" element={<AdminLayout><AdminOrdersPage /></AdminLayout>} />
        <Route path="/admin/orders/:id" element={<AdminLayout><AdminOrderDetailPage /></AdminLayout>} />
        <Route path="/admin/users" element={<AdminLayout><AdminUsersPage /></AdminLayout>} />
        <Route path="/admin/users/create" element={<AdminLayout><AdminCreateUserPage /></AdminLayout>} />
        <Route path="/admin/users/:id" element={<AdminLayout><AdminEditUserPage /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><AdminSettingsPage /></AdminLayout>} />
        <Route path="/admin/content/articles" element={<AdminLayout><AdminArticlesPage /></AdminLayout>} />
        <Route path="/admin/content/articles/create" element={<AdminLayout><AdminCreateArticlePage /></AdminLayout>} />
        <Route path="/admin/content/articles/:id" element={<AdminLayout><AdminEditArticlePage /></AdminLayout>} />
        <Route path="/admin/content/news" element={<AdminLayout><AdminNewsPage /></AdminLayout>} />
        <Route path="/admin/content/news/create" element={<AdminLayout><AdminCreateNewsPage /></AdminLayout>} />
        <Route path="/admin/content/news/:id" element={<AdminLayout><AdminEditNewsPage /></AdminLayout>} />
        <Route path="/admin/content/services" element={<AdminLayout><AdminServicesPage /></AdminLayout>} />
        <Route path="/admin/content/services/create" element={<AdminLayout><AdminCreateServicePage /></AdminLayout>} />
        <Route path="/admin/content/services/:id" element={<AdminLayout><AdminEditServicePage /></AdminLayout>} />
        <Route path="*" element={<PageLayout><NotFoundPage /></PageLayout>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
