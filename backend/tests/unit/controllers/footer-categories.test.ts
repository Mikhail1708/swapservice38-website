import axios from 'axios';
import { getCategories } from '../../../src/controllers/product.controller';
jest.mock('axios');
const get = axios.get as jest.Mock;
const call = async (includeCounts?: string) => {
  const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await getCategories({ query: { includeCounts } } as any, res);
  return res.json.mock.calls[0][0];
};
beforeEach(() => jest.resetAllMocks());
test('existing categories API preserves authoritative CRM counts in one request', async () => {
  get.mockResolvedValue({ data: [{ id: 1, name: 'CATEGORY', _count: { products: 23 } }, { id: 2, name: 'EMPTY', _count: { products: 0 } }] });
  expect(await call('true')).toEqual({ categories: ['CATEGORY', 'EMPTY'], categoryCounts: [
    { name: 'CATEGORY', productCount: 23 }, { name: 'EMPTY', productCount: 0 },
  ] });
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0][0]).toMatch(/\/api\/public\/categories$/);
});
test('normal catalog consumer retains string-array response', async () => {
  get.mockResolvedValue({ data: [{ name: 'Category', _count: { products: 12 } }] });
  expect(await call()).toEqual({ categories: ['Category'] });
});
test('footer never downloads a product page when categories API fails', async () => {
  get.mockRejectedValue(new Error('CRM unavailable'));
  expect(await call('true')).toEqual({ categories: [], categoryCounts: [] });
  expect(get).toHaveBeenCalledTimes(1);
});
test('missing counts are not fabricated from category position or names', async () => {
  get.mockResolvedValue({ data: { categories: [{ name: 'Unknown' }, { name: 'Bad', _count: { products: -1 } }] } });
  expect((await call('true')).categoryCounts).toEqual([]);
});
