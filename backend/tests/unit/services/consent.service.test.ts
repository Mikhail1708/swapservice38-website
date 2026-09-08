import { ensurePersonalDataConsent, findPersonalDataConsent, personalDataEvidence, offerEvidence, PERSONAL_DATA_SCOPE } from '../../../src/services/consent.service';
import { personalDataAcceptance, offerAcceptance } from '../../helpers/consent';

describe('explicit consent evidence', () => {
  const db = { userConsent: { findUnique: jest.fn(), upsert: jest.fn() } } as any;
  beforeEach(() => { jest.resetAllMocks(); db.userConsent.findUnique.mockResolvedValue(null); });

  it.each([undefined, false, 'true', { ...personalDataAcceptance, accepted: false }])('fails closed without literal acceptance %p', (input) => {
    expect(() => personalDataEvidence(input, 'registration')).toThrow();
  });
  it('rejects stale documents and client supplied acceptance timestamps', () => {
    expect(() => personalDataEvidence({ ...personalDataAcceptance, documentVersion: 'old' }, 'registration')).toThrow();
    expect(() => personalDataEvidence({ ...personalDataAcceptance, acceptedAt: '2000-01-01' }, 'checkout')).toThrow();
    expect(() => offerEvidence({ ...offerAcceptance, documentVersion: 'old' })).toThrow();
    expect(() => offerEvidence({ ...offerAcceptance, acceptedAt: '2000-01-01' })).toThrow();
  });
  it('uses server acceptance time for the current offer', () => {
    const before = Date.now();
    const evidence = offerEvidence(offerAcceptance);
    expect(evidence.offerVersion).toBe(offerAcceptance.documentVersion);
    expect(evidence.offerAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
  it('looks up consent by authenticated user and processing scope, not cosmetic document version', async () => {
    const old = { id: 'c1', documentVersion: 'old-edition', scopeVersion: PERSONAL_DATA_SCOPE };
    db.userConsent.findUnique.mockResolvedValue(old);
    expect(await ensurePersonalDataConsent(db, 'user-1', undefined, true)).toEqual(old);
    expect(db.userConsent.findUnique).toHaveBeenCalledWith({ where: { userId_type_scopeVersion: {
      userId: 'user-1', type: 'personal_data', scopeVersion: PERSONAL_DATA_SCOPE,
    } } });
    expect(db.userConsent.upsert).not.toHaveBeenCalled();
  });
  it('preflight validates but does not persist, persistence uses an idempotent unique upsert', async () => {
    await expect(ensurePersonalDataConsent(db, 'legacy', undefined, false)).rejects.toMatchObject({ code: 'PERSONAL_DATA_CONSENT_REQUIRED' });
    expect(await ensurePersonalDataConsent(db, 'legacy', personalDataAcceptance, false)).toBeNull();
    expect(db.userConsent.upsert).not.toHaveBeenCalled();
    await ensurePersonalDataConsent(db, 'legacy', personalDataAcceptance, true);
    expect(db.userConsent.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({
      userId: 'legacy', type: 'personal_data', scopeVersion: PERSONAL_DATA_SCOPE, source: 'checkout',
    }) }));
    await findPersonalDataConsent(db, 'different-user');
    expect(db.userConsent.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({
      userId_type_scopeVersion: expect.objectContaining({ userId: 'different-user' }),
    }) }));
  });
});
