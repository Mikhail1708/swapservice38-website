import axios from 'axios';
import { getProducts } from '../../../src/controllers/product.controller';

jest.mock('axios');
const rows = [
  { id: 1, stock: 3, price: 90 }, { id: 2, stock: 0, price: 10 },
  { id: 3, stock: 15, price: 70 }, { id: 4, stock: -2, price: 80 },
  { id: 5, stock: 8, price: 100 }, { id: 6, stock: 1, price: 20 },
];
beforeEach(() => {
  jest.clearAllMocks();
  (axios.get as jest.Mock).mockImplementation(async (_url, { params }) => ({ data: {
    items: rows.slice((Number(params.page) - 1) * 2, Number(params.page) * 2), totalPages: 3, total: 6,
  } }));
});
const request = async (query: any) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await getProducts({ query } as any, res as any);
  return res;
};
it.each([
  [{ availability: 'in_stock' }, [3, 5, 1, 6]],
  [{ availability: 'on_order' }, [2, 4]],
  [{ sort: 'price_asc' }, [2, 6, 3, 4, 1, 5]],
  [{ sort: 'price_desc' }, [5, 1, 4, 3, 6, 2]],
  [{ availability: 'in_stock', sort: 'price_asc' }, [6, 3, 1, 5]],
  [{ availability: 'in_stock', sort: 'price_desc' }, [5, 1, 3, 6]],
] as const)('filters/orders all upstream pages for %j', async (query, ids) => {
  const res = await request(query);
  expect(res.json.mock.calls[0][0].items.map((item: any) => item.id)).toEqual(ids);
  expect(axios.get).toHaveBeenCalledTimes(3);
});
it('keeps All and default on the existing paginated proxy', async () => {
  const res = await request({});
  expect(res.json.mock.calls[0][0].items.map((item: any) => item.id)).toEqual([1, 2]);
  expect(axios.get).toHaveBeenCalledTimes(1);
});
it('paginates after global sorting and preserves category/search on every CRM request', async () => {
  const res = await request({ availability: 'in_stock', category: '3', search: 'part', page: '2', limit: '2' });
  expect(res.json.mock.calls[0][0]).toMatchObject({ total: 4, page: 2, limit: 2, totalPages: 2 });
  expect(res.json.mock.calls[0][0].items.map((item: any) => item.id)).toEqual([1, 6]);
  for (const [, config] of (axios.get as jest.Mock).mock.calls) expect(config.params).toMatchObject({ category: '3', search: 'part' });
});
it('restores stock DESC when explicit price sorting is removed', async () => {
  await request({ availability: 'in_stock', sort: 'price_asc' });
  const res = await request({ availability: 'in_stock' });
  expect(res.json.mock.calls[0][0].items.map((item: any) => item.id)).toEqual([3, 5, 1, 6]);
});
it('does not return a partial catalogue after an upstream failure', async () => {
  (axios.get as jest.Mock).mockRejectedValueOnce(new Error('upstream unavailable'));
  expect((await request({ availability: 'in_stock' })).status).toHaveBeenCalledWith(500);
});
it.each([{ availability: 'bad' }, { sort: ['price_asc'] }, { sort: 'price_asc', page: '-1' }])('rejects invalid query %j', async query => {
  expect((await request(query)).status).toHaveBeenCalledWith(400);
  expect(axios.get).not.toHaveBeenCalled();
});
