import { CONSENT_DOCUMENTS } from '../../src/services/consent.service';

export const personalDataAcceptance = {
  accepted: true,
  documentVersion: CONSENT_DOCUMENTS.personalDataVersion,
  privacyVersion: CONSENT_DOCUMENTS.privacyVersion,
};
export const offerAcceptance = { accepted: true, documentVersion: CONSENT_DOCUMENTS.offerVersion };
