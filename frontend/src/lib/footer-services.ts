export interface FooterService { id: string; name: string; }

// The public endpoint already filters active services and defines their order.
export async function loadFooterServices(signal: AbortSignal): Promise<FooterService[]> {
  try {
    const response = await fetch('/api/services', { signal, cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.services)) return [];
    return data.services.filter((service: any) => service &&
      typeof service.id === 'string' && typeof service.name === 'string' &&
      service.isActive !== false && service.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU') !== 'свапы двигателей').slice(0, 4);
  } catch {
    return [];
  }
}
