export const getInternalApiKey = (): string => {
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) throw new Error('INTERNAL_API_KEY is not configured');
  return apiKey;
};
