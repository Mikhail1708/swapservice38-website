"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailJobData = exports.BRAND_LOGO_ATTACHMENT = exports.BRAND_LOGO_CID = void 0;
const path_1 = __importDefault(require("path"));
exports.BRAND_LOGO_CID = 'swapservice38-logo';
exports.BRAND_LOGO_ATTACHMENT = Object.freeze({
    filename: 'swapservice38-logo.png',
    path: path_1.default.resolve(__dirname, '../../assets/brand/logo.png'),
    cid: exports.BRAND_LOGO_CID,
});
const createEmailJobData = (to, subject, html, text) => ({
    to,
    subject,
    html,
    ...(text ? { text } : {}),
    attachments: [exports.BRAND_LOGO_ATTACHMENT],
});
exports.createEmailJobData = createEmailJobData;
//# sourceMappingURL=emailAttachments.js.map