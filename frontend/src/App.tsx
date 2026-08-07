// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

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
// СТРАНИЦЫ АВТОРИЗАЦИИ (AUTH)
// ============================================================
import LoginPage from '@/app/(auth)/login/page'
import RegisterPage from '@/app/(auth)/register/page'
import VerifyPage from '@/app/(auth)/verify/page'
import ResetPasswordPage from '@/app/(auth)/reset-password/page'
import ResetPasswordNewPage from '@/app/(auth)/reset-password/new/page'
import ResetPasswordVerifyPage from '@/app/(auth)/reset-password/verify/page'
import ProfilePage from '@/app/(auth)/profile/page'
import ChangePasswordPage from '@/app/(auth)/profile/change-password/page'
import OrdersPage from '@/app/(auth)/profile/orders/page'
import OrderDetailPage from '@/app/(auth)/profile/orders/details/page'
import OAuthCallbackPage from '@/app/(auth)/oauth-callback/page'
import OAuthSuccessPage from '@/app/(auth)/oauth-success/page'

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

function App() {
  return (
    <BrowserRouter>
      <SiteHeader />
      <main>
        <Routes>
          {/* ===== ПУБЛИЧНЫЕ ===== */}
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/catalog/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:id" element={<ServiceDetailPage />} />
          <Route path="/swaps" element={<SwapsPage />} />
          <Route path="/swaps/:id" element={<SwapDetailPage />} />
          <Route path="/offer" element={<OfferPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/fail" element={<PaymentFailPage />} />
          <Route path="/payment/:orderId" element={<PaymentPage />} />

          {/* ===== АВТОРИЗАЦИЯ ===== */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/new" element={<ResetPasswordNewPage />} />
          <Route path="/reset-password/verify" element={<ResetPasswordVerifyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/change-password" element={<ChangePasswordPage />} />
          <Route path="/profile/orders" element={<OrdersPage />} />
          <Route path="/profile/orders/details" element={<OrderDetailPage />} />
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
          <Route path="/oauth-success" element={<OAuthSuccessPage />} />

          {/* ===== АДМИНКА ===== */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/create" element={<AdminCreateUserPage />} />
          <Route path="/admin/users/:id" element={<AdminEditUserPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/content/articles" element={<AdminArticlesPage />} />
          <Route path="/admin/content/articles/create" element={<AdminCreateArticlePage />} />
          <Route path="/admin/content/articles/:id" element={<AdminEditArticlePage />} />
          <Route path="/admin/content/news" element={<AdminNewsPage />} />
          <Route path="/admin/content/news/create" element={<AdminCreateNewsPage />} />
          <Route path="/admin/content/news/:id" element={<AdminEditNewsPage />} />
          <Route path="/admin/content/services" element={<AdminServicesPage />} />
          <Route path="/admin/content/services/create" element={<AdminCreateServicePage />} />
          <Route path="/admin/content/services/:id" element={<AdminEditServicePage />} />
        </Routes>
      </main>
      <SiteFooter />
    </BrowserRouter>
  )
}

export default App