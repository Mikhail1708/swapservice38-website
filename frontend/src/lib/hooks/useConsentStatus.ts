import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithCsrf } from '../csrf';

export interface ConsentDocuments {
  personalDataVersion: string;
  privacyVersion: string;
  offerVersion: string;
}

export const personalDataAcceptance = (documents: ConsentDocuments) => ({
  accepted: true, documentVersion: documents.personalDataVersion, privacyVersion: documents.privacyVersion,
});

export function useConsentStatus(userId?: string) {
  const requestSequence = useRef(0);
  const [state, setState] = useState<{ owner?: string; documents: ConsentDocuments | null; requiresPersonalDataConsent: boolean; error: string }>({
    documents: null, requiresPersonalDataConsent: true, error: '',
  });
  const reload = useCallback(async () => {
    const request = ++requestSequence.current;
    setState({ owner: userId, documents: null, requiresPersonalDataConsent: true, error: '' });
    try {
      const response = await fetchWithCsrf(userId ? '/api/auth/consent-status' : '/api/auth/consent-documents', { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить сведения о согласиях. Попробуйте обновить страницу.');
      const data = await response.json();
      if (!data.documents?.personalDataVersion || !data.documents?.privacyVersion || !data.documents?.offerVersion) throw new Error('Некорректный ответ');
      if (request !== requestSequence.current) return;
      setState({ owner: userId, documents: data.documents, requiresPersonalDataConsent: data.requiresPersonalDataConsent !== false, error: '' });
    } catch {
      if (request !== requestSequence.current) return;
      setState({ owner: userId, documents: null, requiresPersonalDataConsent: true, error: 'Не удалось загрузить сведения о согласиях. Попробуйте обновить страницу.' });
    }
  }, [userId]);
  useEffect(() => { void reload(); return () => { requestSequence.current += 1; }; }, [reload]);
  const current = state.owner === userId;
  return { documents: current ? state.documents : null, requiresPersonalDataConsent: !current || state.requiresPersonalDataConsent, error: current ? state.error : '', reload };
}
