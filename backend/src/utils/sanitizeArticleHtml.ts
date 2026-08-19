import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p', 'br', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'code', 'pre',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'hr', 'figure', 'figcaption',
];

/** Sanitizes rich article content before it is persisted. */
export const sanitizeArticleHtml = (html: string): string => sanitizeHtml(html, {
  allowedTags,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === '_blank'
        ? { ...attribs, rel: 'noopener noreferrer' }
        : attribs,
    }),
  },
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
});
