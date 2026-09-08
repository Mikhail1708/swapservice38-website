import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';

export const CONSENT_DOCUMENTS = {
  personalDataVersion: '2026-09-08', privacyVersion: '2026-09-08', offerVersion: '2026-09-08.1',
} as const;
// Change only after an explicit decision that processing purposes require renewed consent.
// A document typo/layout revision alone must NOT change this identifier.
export const PERSONAL_DATA_SCOPE = 'account-orders-v1';
export const personalDataAcceptanceSchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }) }),
  documentVersion: z.string(), privacyVersion: z.string(),
}, { required_error: 'Необходимо согласие на обработку персональных данных', invalid_type_error: 'Необходимо явно подтвердить согласие на обработку персональных данных' }).strict();
export const offerAcceptanceSchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: 'Необходимо принять условия Публичной оферты' }) }),
  documentVersion: z.string(),
}, { required_error: 'Необходимо принять условия Публичной оферты', invalid_type_error: 'Необходимо явно принять условия Публичной оферты' }).strict();
type ConsentDb = Pick<Prisma.TransactionClient, 'userConsent'>;
const consentWhere = (userId: string) => ({
  userId_type_scopeVersion: { userId, type: 'personal_data', scopeVersion: PERSONAL_DATA_SCOPE },
});
export const personalDataEvidence = (input: unknown, source: 'registration' | 'checkout') => {
  const parsed = personalDataAcceptanceSchema.safeParse(input);
  if (!parsed.success) throw new AppError('Необходимо согласие на обработку персональных данных', 400, 'PERSONAL_DATA_CONSENT_REQUIRED');
  if (parsed.data.documentVersion !== CONSENT_DOCUMENTS.personalDataVersion || parsed.data.privacyVersion !== CONSENT_DOCUMENTS.privacyVersion) {
    throw new AppError('Документы обновились. Обновите страницу и ознакомьтесь с актуальной редакцией', 409, 'CONSENT_DOCUMENT_CHANGED');
  }
  return { type: 'personal_data', scopeVersion: PERSONAL_DATA_SCOPE,
    documentVersion: parsed.data.documentVersion, privacyVersion: parsed.data.privacyVersion, source };
};
export const offerEvidence = (input: unknown) => {
  const parsed = offerAcceptanceSchema.safeParse(input);
  if (!parsed.success) throw new AppError('Необходимо принять условия Публичной оферты', 400, 'OFFER_ACCEPTANCE_REQUIRED');
  if (parsed.data.documentVersion !== CONSENT_DOCUMENTS.offerVersion) {
    throw new AppError('Оферта обновилась. Обновите страницу и ознакомьтесь с актуальной редакцией', 409, 'CONSENT_DOCUMENT_CHANGED');
  }
  return { offerVersion: parsed.data.documentVersion, offerAcceptedAt: new Date() };
};
export const findPersonalDataConsent = (db: ConsentDb, userId: string) => db.userConsent.findUnique({ where: consentWhere(userId) });
export const ensurePersonalDataConsent = async (db: ConsentDb, userId: string, input: unknown, persist: boolean) => {
  const existing = await findPersonalDataConsent(db, userId);
  if (existing) return existing;
  const evidence = personalDataEvidence(input, 'checkout');
  if (!persist) return null;
  return db.userConsent.upsert({ where: consentWhere(userId), update: {}, create: { userId, ...evidence } });
};
