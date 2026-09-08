import { useId } from 'react';

type Props = {
  variant: 'personalData' | 'offer';
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ConsentCheckbox({ variant, checked, onChange, disabled = false }: Props) {
  const id = useId();
  const descriptionId = `${id}-documents`;
  const personalData = variant === 'personalData';
  return <div className="space-y-2 text-sm">
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}
        disabled={disabled} required aria-describedby={descriptionId}
        className="mt-1 h-4 w-4 shrink-0 accent-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" />
      <label htmlFor={id} className="text-foreground cursor-pointer leading-6">
        {personalData ? 'Я даю согласие на обработку персональных данных и ознакомлен с Политикой конфиденциальности' : 'Я принимаю условия Публичной оферты'}
      </label>
    </div>
    <div id={descriptionId} className="pl-7 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
      {personalData ? <>
        <a href="/personal-data-consent" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Согласие на обработку персональных данных</a>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Политика конфиденциальности</a>
      </> : <a href="/offer" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Публичная оферта</a>}
    </div>
  </div>;
}
