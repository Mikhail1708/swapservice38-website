describe('F21 Redis connection authentication', () => {
  const keys = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];
  let previous: Record<string, string | undefined>;

  beforeEach(() => {
    previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    process.env.REDIS_HOST = 'redis.example.test';
    process.env.REDIS_PORT = '6381';
  });
  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it.each(['configured', 'absent', 'empty'])('both Bull queues use connection auth: %s', mode => {
    if (mode === 'absent') delete process.env.REDIS_PASSWORD;
    else process.env.REDIS_PASSWORD = mode === 'empty' ? '' : 'f21-fictional-redis-secret';
    jest.isolateModules(() => {
      const Bull = require('bull');
      Bull.mockClear();
      jest.requireActual('../../../src/services/email.service');
      jest.requireActual('../../../src/queues/crm.queue');
      expect(Bull.mock.calls.map((call: any[]) => call[0]).sort()).toEqual(['crm queue', 'email queue']);
      for (const [, options] of Bull.mock.calls) {
        expect(options.redis).toEqual(expect.objectContaining({
          host: 'redis.example.test', port: 6381,
          password: mode === 'configured' ? process.env.REDIS_PASSWORD : undefined,
        }));
        expect(options.createClient).toBeUndefined();
      }
    });
  });
});
