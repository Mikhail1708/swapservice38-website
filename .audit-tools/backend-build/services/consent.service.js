"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePersonalDataConsent = exports.findPersonalDataConsent = exports.offerEvidence = exports.personalDataEvidence = exports.offerAcceptanceSchema = exports.personalDataAcceptanceSchema = exports.PERSONAL_DATA_SCOPE = exports.CONSENT_DOCUMENTS = void 0;
const zod_1 = require("zod");
const error_middleware_1 = require("../middleware/error.middleware");
exports.CONSENT_DOCUMENTS = {
    personalDataVersion: '2026-09-08', privacyVersion: '2026-09-08', offerVersion: '2026-09-08.1',
};
// Change only after an explicit decision that processing purposes require renewed consent.
// A document typo/layout revision alone must NOT change this identifier.
exports.PERSONAL_DATA_SCOPE = 'account-orders-v1';
exports.personalDataAcceptanceSchema = zod_1.z.object({
    accepted: zod_1.z.literal(true, { errorMap: () => ({ message: 'Необходимо согласие на обработку персональных данных' }) }),
    documentVersion: zod_1.z.string(), privacyVersion: zod_1.z.string(),
}, { required_error: 'Необходимо согласие на обработку персональных данных', invalid_type_error: 'Необходимо явно подтвердить согласие на обработку персональных данных' }).strict();
exports.offerAcceptanceSchema = zod_1.z.object({
    accepted: zod_1.z.literal(true, { errorMap: () => ({ message: 'Необходимо принять условия Публичной оферты' }) }),
    documentVersion: zod_1.z.string(),
}, { required_error: 'Необходимо принять условия Публичной оферты', invalid_type_error: 'Необходимо явно принять условия Публичной оферты' }).strict();
const consentWhere = (userId) => ({
    userId_type_scopeVersion: { userId, type: 'personal_data', scopeVersion: exports.PERSONAL_DATA_SCOPE },
});
const personalDataEvidence = (input, source) => {
    const parsed = exports.personalDataAcceptanceSchema.safeParse(input);
    if (!parsed.success)
        throw new error_middleware_1.AppError('Необходимо согласие на обработку персональных данных', 400, 'PERSONAL_DATA_CONSENT_REQUIRED');
    if (parsed.data.documentVersion !== exports.CONSENT_DOCUMENTS.personalDataVersion || parsed.data.privacyVersion !== exports.CONSENT_DOCUMENTS.privacyVersion) {
        throw new error_middleware_1.AppError('Документы обновились. Обновите страницу и ознакомьтесь с актуальной редакцией', 409, 'CONSENT_DOCUMENT_CHANGED');
    }
    return { type: 'personal_data', scopeVersion: exports.PERSONAL_DATA_SCOPE,
        documentVersion: parsed.data.documentVersion, privacyVersion: parsed.data.privacyVersion, source };
};
exports.personalDataEvidence = personalDataEvidence;
const offerEvidence = (input) => {
    const parsed = exports.offerAcceptanceSchema.safeParse(input);
    if (!parsed.success)
        throw new error_middleware_1.AppError('Необходимо принять условия Публичной оферты', 400, 'OFFER_ACCEPTANCE_REQUIRED');
    if (parsed.data.documentVersion !== exports.CONSENT_DOCUMENTS.offerVersion) {
        throw new error_middleware_1.AppError('Оферта обновилась. Обновите страницу и ознакомьтесь с актуальной редакцией', 409, 'CONSENT_DOCUMENT_CHANGED');
    }
    return { offerVersion: parsed.data.documentVersion, offerAcceptedAt: new Date() };
};
exports.offerEvidence = offerEvidence;
const findPersonalDataConsent = (db, userId) => db.userConsent.findUnique({ where: consentWhere(userId) });
exports.findPersonalDataConsent = findPersonalDataConsent;
const ensurePersonalDataConsent = async (db, userId, input, persist) => {
    const existing = await (0, exports.findPersonalDataConsent)(db, userId);
    if (existing)
        return existing;
    const evidence = (0, exports.personalDataEvidence)(input, 'checkout');
    if (!persist)
        return null;
    return db.userConsent.upsert({ where: consentWhere(userId), update: {}, create: { userId, ...evidence } });
};
exports.ensurePersonalDataConsent = ensurePersonalDataConsent;
//# sourceMappingURL=consent.service.js.map