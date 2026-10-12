"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentialVersion = void 0;
const crypto_1 = require("crypto");
const credentialVersion = (passwordHash) => (0, crypto_1.createHash)('sha256').update(passwordHash || 'oauth-only').digest('hex').slice(0, 24);
exports.credentialVersion = credentialVersion;
//# sourceMappingURL=credentialVersion.js.map