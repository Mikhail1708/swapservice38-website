export declare const safeRedis: {
    get: jest.Mock<any, any, any>;
    setex: jest.Mock<any, any, any>;
    del: jest.Mock<any, any, any>;
    keys: jest.Mock<any, any, any>;
    incr: jest.Mock<any, any, any>;
    expire: jest.Mock<any, any, any>;
    ttl: jest.Mock<any, any, any>;
    flushall: jest.Mock<any, any, any>;
    setJson: jest.Mock<any, any, any>;
    getJson: jest.Mock<any, any, any>;
};
declare const redis: {
    get: jest.Mock<any, any, any>;
    set: jest.Mock<any, any, any>;
    setex: jest.Mock<any, any, any>;
    del: jest.Mock<any, any, any>;
    keys: jest.Mock<any, any, any>;
    incr: jest.Mock<any, any, any>;
    expire: jest.Mock<any, any, any>;
    ttl: jest.Mock<any, any, any>;
    flushall: jest.Mock<any, any, any>;
    ping: jest.Mock<any, any, any>;
    on: jest.Mock<any, any, any>;
    quit: jest.Mock<any, any, any>;
    duplicate: jest.Mock<any, any, any>;
    disconnect: jest.Mock<any, any, any>;
    defineCommand: jest.Mock<any, any, any>;
    sendCommand: jest.Mock<any, any, any>;
    pipeline: jest.Mock<any, any, any>;
    exec: jest.Mock<any, any, any>;
    multi: jest.Mock<any, any, any>;
    call: jest.Mock<any, any, any>;
};
export default redis;
//# sourceMappingURL=redis.d.ts.map