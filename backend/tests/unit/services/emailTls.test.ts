describe('F10 production SMTP certificate verification', () => {
  const keys = ['NODE_ENV', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
  let previous: Record<string, string | undefined>;

  beforeEach(() => {
    previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_USER = 'smtp-test-user';
    process.env.SMTP_PASS = 'smtp-test-password';
    process.env.EMAIL_FROM = 'sender@example.test';
  });

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it.each([
    ['true', '465', true],
    ['false', '587', false],
  ])('preserves secure=%s and default TLS verification', async (secure, port, expectedSecure) => {
    process.env.SMTP_SECURE = secure as string;
    process.env.SMTP_PORT = port as string;
    let worker: (job: any) => Promise<unknown>;
    let transport: any;
    jest.isolateModules(() => {
      const mailer = require('nodemailer');
      const Bull = require('bull');
      mailer.createTransport.mockClear();
      Bull.mockClear();
      jest.requireActual('../../../src/services/email.service');
      expect(mailer.createTransport).toHaveBeenCalledTimes(1);
      const options = mailer.createTransport.mock.calls[0][0];
      expect(options).toEqual({
        host: 'smtp.example.test', port: Number(port), secure: expectedSecure,
        auth: { user: 'smtp-test-user', pass: 'smtp-test-password' },
      });
      expect(options.tls?.rejectUnauthorized).not.toBe(false);
      expect(options.ignoreTLS).not.toBe(true);
      transport = mailer.createTransport.mock.results[0].value;
      expect(transport.verify).toHaveBeenCalled();
      worker = Bull.mock.results[0].value.process.mock.calls[0][0];
    });
    await worker!({ data: { to: 'recipient@example.test', subject: 'Test', html: '<p>Test</p>' } });
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'sender@example.test' }));
    const tlsError = Object.assign(new Error('Untrusted test certificate'), { code: 'CERT_HAS_EXPIRED' });
    transport.sendMail.mockRejectedValueOnce(tlsError);
    await expect(worker!({ data: {} })).rejects.toBe(tlsError);
  });
});
