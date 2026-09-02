import axios from 'axios';
import { getAddressSuggestions } from '../../../src/services/addressSuggestions.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Address suggestions service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DADATA_API_KEY = 'server-only-test-key';
  });

  afterEach(() => delete process.env.DADATA_API_KEY);

  it('keeps the secret server-side and returns only projected fields', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        suggestions: [{
          value: 'Иркутск, улица Ленина, 1',
          unrestricted_value: '664000, Иркутск, улица Ленина, 1',
          data: { city: 'Иркутск', street: 'Ленина', house: '1', secret: 'discard-me' },
        }],
      },
    } as any);

    const result = await getAddressSuggestions('Ленина 1');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('dadata.ru'),
      expect.objectContaining({ query: 'Ленина 1' }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Token server-only-test-key' }) }),
    );
    expect(result[0].data).not.toHaveProperty('secret');
  });

  it('fails closed when the server credential is absent', async () => {
    delete process.env.DADATA_API_KEY;
    await expect(getAddressSuggestions('Ленина 1')).rejects.toThrow('DADATA_NOT_CONFIGURED');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('treats a malformed provider response as no suggestions', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { suggestions: 'invalid' } } as any);
    await expect(getAddressSuggestions('Ленина 1')).resolves.toEqual([]);
  });
});
