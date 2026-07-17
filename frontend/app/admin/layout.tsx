import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Админ-панель — SWAP SERVICE 38',
  description: 'Управление сайтом SWAP SERVICE 38',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}