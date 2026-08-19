import { sanitizeArticleHtml } from '../../../src/utils/sanitizeArticleHtml';

describe('sanitizeArticleHtml', () => {
  it('keeps supported rich text and removes executable content', () => {
    const result = sanitizeArticleHtml(
      '<h2>Title</h2><script>alert(1)</script><p onclick="alert(2)">Text</p>',
    );

    expect(result).toBe('<h2>Title</h2><p>Text</p>');
  });

  it('removes unsafe URL schemes', () => {
    const result = sanitizeArticleHtml(
      '<a href="javascript:alert(1)">bad</a><img src="data:image/svg+xml,bad">',
    );

    expect(result).toBe('<a>bad</a><img />');
  });

  it('protects links opened in a new tab', () => {
    const result = sanitizeArticleHtml('<a href="https://example.com" target="_blank">safe</a>');

    expect(result).toContain('rel="noopener noreferrer"');
  });
});
