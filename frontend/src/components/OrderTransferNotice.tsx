import { Link } from '@/lib/next-shims';

/** Prepayment information, not a second acceptance mechanism. */
export function OrderTransferNotice({ deliveryMethod }: { deliveryMethod: string }) {
  return (
    <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
      <p>Товар в наличии: передача в службу доставки или подготовка к самовывозу — не позднее 3 рабочих дней после подтверждения полной оплаты, если иной конкретный срок не согласован до оплаты.</p>
      {deliveryMethod === 'pickup'
        ? <p className="mt-2">Мы уведомим о готовности к выдаче. Получение — в согласованное с вами время.</p>
        : <p className="mt-2">Это срок отправки, не получения посылки. Стоимость доставки не включена в сумму товаров и рассчитывается отдельно. До предоплаты необходимо согласовать стоимость доставки и конкретный срок передачи заказа получателю.</p>}
      <p className="mt-2">Условия и порядок отсчёта срока — в <Link href="/offer" className="underline underline-offset-4 hover:text-foreground">Публичной оферте</Link>, раздел 7.</p>
    </div>
  );
}
