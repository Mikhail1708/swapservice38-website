import { createHash } from 'crypto';

export const credentialVersion = (passwordHash: string | null | undefined): string =>
  createHash('sha256').update(passwordHash || 'oauth-only').digest('hex').slice(0, 24);
