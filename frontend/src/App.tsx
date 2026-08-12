// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AdminLayout } from '@/components/admin/layout/AdminLayout' // ✅ ДОБАВЛЯЕМ!

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
      <Routes>
        {/* ===== ПУБЛИЧНЫЕ САЙТ (С ХЕДЕРОМ И ФУТЕРОМ) ===== */}
        <Route
          path="/"
          element={
            <>
              <SiteHeader />
              <main>
                <HomePage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/catalog"
          element={
            <>
              <SiteHeader />
              <main>
                <CatalogPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/catalog/:id"
          element={
            <>
              <SiteHeader />
              <main>
                <ProductPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/cart"
          element={
            <>
              <SiteHeader />
              <main>
                <CartPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/contacts"
          element={
            <>
              <SiteHeader />
              <main>
                <ContactsPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/services"
          element={
            <>
              <SiteHeader />
              <main>
                <ServicesPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/services/:id"
          element={
            <>
              <SiteHeader />
              <main>
                <ServiceDetailPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/swaps"
          element={
            <>
              <SiteHeader />
              <main>
                <SwapsPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/swaps/:id"
          element={
            <>
              <SiteHeader />
              <main>
                <SwapDetailPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/offer"
          element={
            <>
              <SiteHeader />
              <main>
                <OfferPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/privacy"
          element={
            <>
              <SiteHeader />
              <main>
                <PrivacyPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/payment/success"
          element={
            <>
              <SiteHeader />
              <main>
                <PaymentSuccessPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/payment/fail"
          element={
            <>
              <SiteHeader />
              <main>
                <PaymentFailPage />
              </main>
              <SiteFooter />
            </>
          }
        />
        <Route
          path="/payment/:orderId"
          element={
            <>
              <SiteHeader />
              <main>
                <PaymentPage />
              </main>
              <SiteFooter />
            </>
          }
        />

        {/* ===== АВТОРИЗАЦИЯ (БЕЗ ХЕДЕРА/ФУТЕРА) ===== */}
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

        {/* ===== АДМИНКА — ОБЁРНУТА В AdminLayout ===== */}
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
      </Routes>
    </BrowserRouter>
  )
}

export default App