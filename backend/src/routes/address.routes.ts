import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { getAddressSuggestions } from '../services/addressSuggestions.service';

const router = Router();
const requestSchema = z.object({ query: z.string().trim().min(3).max(200) });
const suggestionsLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'ADDRESS_RATE_LIMITED', error: 'Подсказки временно недоступны' },
});

router.post('/suggestions', requireAuth, suggestionsLimiter, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'INVALID_ADDRESS_QUERY', error: 'Введите не менее трёх символов' });
    return;
  }
  try {
    const suggestions = await getAddressSuggestions(parsed.data.query);
    res.json({ suggestions });
  } catch {
    res.status(503).json({ code: 'ADDRESS_SUGGESTIONS_UNAVAILABLE', error: 'Подсказки временно недоступны' });
  }
});

export default router;
