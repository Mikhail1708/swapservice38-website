import { Link } from '@/lib/next-shims';

export default function NotFoundPage() {
  return (
    <section className="container-custom min-h-[70vh] pt-36 pb-20 flex items-center justify-center text-center">
      <div>
        <p className="text-sm text-muted-foreground mb-3">Ошибка 404</p>
        <h1 className="text-3xl font-bold text-foreground mb-3">Страница не найдена</h1>
        <p className="text-muted-foreground mb-8">Проверьте адрес или вернитесь на главную страницу.</p>
        <Link href="/" className="inline-flex px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition">
          На главную
        </Link>
      </div>
    </section>
  );
}
