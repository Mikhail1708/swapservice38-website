"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMOVE_COMPLETED_EMAIL = exports.CLAIM_SMTP_ATTEMPT = exports.EMAIL_CLEANUP_INTERVAL_MS = exports.EMAIL_CLEANUP_BATCH_SIZE = exports.EMAIL_RETENTION_MS = exports.EMAIL_OUTBOX_MAX_ATTEMPTS = exports.EMAIL_MAX_ATTEMPTS = void 0;
exports.claimSmtpAttempt = claimSmtpAttempt;
exports.createEmailCleanup = createEmailCleanup;
exports.EMAIL_MAX_ATTEMPTS = 3;
exports.EMAIL_OUTBOX_MAX_ATTEMPTS = 5;
exports.EMAIL_RETENTION_MS = 30 * 24 * 60 * 60000;
exports.EMAIL_CLEANUP_BATCH_SIZE = 100;
exports.EMAIL_CLEANUP_INTERVAL_MS = 60 * 60000;
// Bull attemptsMade counts failures, not claims lost to crashes/stalls. Consume
// an independent durable SMTP budget before sending, under the Bull owner lock.
exports.CLAIM_SMTP_ATTEMPT = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return -1 end
local count = tonumber(redis.call('HGET', KEYS[1], 'smtpAttempts'))
if not count then
  count = tonumber(redis.call('HGET', KEYS[1], 'attemptsMade') or '0') +
    tonumber(redis.call('HGET', KEYS[1], 'stalledCounter') or '0')
end
if count >= tonumber(ARGV[2]) then return 0 end
redis.call('HSET', KEYS[1], 'smtpAttempts', count + 1)
return count + 1
`;
async function claimSmtpAttempt(queue, job) {
    const max = String(job.id).startsWith('email-outbox-') ? exports.EMAIL_OUTBOX_MAX_ATTEMPTS : exports.EMAIL_MAX_ATTEMPTS;
    const key = queue.toKey(String(job.id));
    // Bull 4 uses one ownership token per Queue instance (also used by its Lua
    // completion/failure scripts); this property is missing only from its types.
    const token = queue.token;
    if (!token)
        throw new Error('EMAIL_WORKER_LOCK_UNAVAILABLE');
    const result = Number(await queue.client.eval(exports.CLAIM_SMTP_ATTEMPT, 2, key, `${key}:lock`, token, max));
    if (result === -1)
        throw new Error('EMAIL_WORKER_LOCK_LOST');
    if (result === 0) {
        job.discard();
        throw new Error('EMAIL_SMTP_ATTEMPTS_EXHAUSTED');
    }
    if (!Number.isSafeInteger(result) || result < 1 || result > max)
        throw new Error('EMAIL_ATTEMPT_CLAIM_FAILED');
}
// Redis-side filtering/deletion is atomic. Never remove a job that changed
// state, was retried, or acquired an owner lock since candidate selection.
exports.REMOVE_COMPLETED_EMAIL = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not score or tonumber(score) >= tonumber(ARGV[2]) then return 0 end
if redis.call('EXISTS', KEYS[4]) ~= 0 then return 0 end
local finished = redis.call('HGET', KEYS[2], 'finishedOn')
if not finished or tonumber(finished) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2], KEYS[3])
return 1
`;
function createEmailCleanup(queue, db) {
    // Advance past completed jobs whose DB ACK is missing/failed; otherwise a
    // blocked first batch could permanently starve later eligible completions.
    let offset = 0;
    return async () => {
        const cutoff = Date.now() - exports.EMAIL_RETENTION_MS;
        const completed = queue.toKey('completed');
        const ids = await queue.client.zrangebyscore(completed, 0, `(${cutoff}`, 'LIMIT', offset, exports.EMAIL_CLEANUP_BATCH_SIZE);
        let removed = 0;
        for (const id of ids) {
            const job = await queue.getJob(id);
            if (!job || !job.finishedOn || job.finishedOn >= cutoff || !(await job.isCompleted()))
                continue;
            if (id.startsWith('email-outbox-')) {
                const eventId = id.slice('email-outbox-'.length);
                // dispatched alone does NOT prove SMTP success. It is safe only after
                // the paired retained Bull completion above. Delete DB first: a crash
                // leaves a harmless completed Redis orphan recoverable next cleanup.
                const deleted = await db.emailOutboxEvent.deleteMany({ where: {
                        id: eventId, status: 'dispatched', processedAt: { lt: new Date(cutoff) }, lockedAt: null,
                    } });
                if (!deleted.count && await db.emailOutboxEvent.findUnique({ where: { id: eventId }, select: { id: true } }))
                    continue;
            }
            const key = queue.toKey(id);
            removed += Number(await queue.client.eval(exports.REMOVE_COMPLETED_EMAIL, 4, completed, key, `${key}:logs`, `${key}:lock`, id, cutoff));
        }
        offset = ids.length < exports.EMAIL_CLEANUP_BATCH_SIZE ? 0 : offset + ids.length - removed;
    };
}
//# sourceMappingURL=emailQueuePolicy.js.map