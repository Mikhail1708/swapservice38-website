export interface FooterCategory { name: string; productCount: number; }

export async function loadFooterCategories(signal: AbortSignal): Promise<FooterCategory[]> {
  try {
    const response = await fetch('/api/products/categories?includeCounts=true', { signal, cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.categoryCounts)) return [];
    return data.categoryCounts.filter((category: FooterCategory) => category &&
      typeof category.name === 'string' && category.name.trim() &&
      Number.isSafeInteger(category.productCount) && category.productCount > 0)
      .sort((a: FooterCategory, b: FooterCategory) => b.productCount - a.productCount)
      .slice(0, 5);
  } catch {
    return [];
  }
}
