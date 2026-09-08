export function matchesProductCategory(
  product: { category?: string; categories?: Array<{ id: number; name: string }> },
  selectedCategory: string,
) {
  return !selectedCategory || product.category === selectedCategory ||
    Boolean(product.categories?.some(category => category.name === selectedCategory || String(category.id) === selectedCategory));
}
