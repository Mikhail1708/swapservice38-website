import axios from 'axios';

export interface AddressSuggestion {
  value: string;
  unrestricted_value: string;
  data: {
    postal_code?: string;
    country?: string;
    region?: string;
    city?: string;
    street?: string;
    house?: string;
    flat?: string;
    geo_lat?: string;
    geo_lon?: string;
  };
}

export const getAddressSuggestions = async (query: string): Promise<AddressSuggestion[]> => {
  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) throw new Error('DADATA_NOT_CONFIGURED');

  const response = await axios.post(
    'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
    {
      query,
      count: 6,
      from_bound: { value: 'street' },
      to_bound: { value: 'house' },
    },
    {
      timeout: 5_000,
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    },
  );

  const items = Array.isArray(response.data?.suggestions) ? response.data.suggestions : [];
  return items.slice(0, 6).flatMap((item: any) => {
    if (!item || typeof item.value !== 'string') return [];
    const data = item.data && typeof item.data === 'object' ? item.data : {};
    return [{
      value: item.value,
      unrestricted_value: typeof item.unrestricted_value === 'string' ? item.unrestricted_value : item.value,
      data: {
        postal_code: data.postal_code,
        country: data.country,
        region: data.region,
        city: data.city,
        street: data.street,
        house: data.house,
        flat: data.flat,
        geo_lat: data.geo_lat,
        geo_lon: data.geo_lon,
      },
    }];
  });
};
