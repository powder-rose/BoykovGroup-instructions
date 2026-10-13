import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeJsonLd } from '../../client/src/lib/jsonLd.js';

test('serializeJsonLd escapes HTML-sensitive characters and preserves JSON values', () => {
  const value = {
    title: '</script><img src=x onerror=alert(1)>',
    ampersand: 'A&B',
    separators: '\u2028\u2029',
  };

  const serialized = serializeJsonLd(value);

  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('>'), false);
  assert.equal(serialized.includes('&'), false);
  assert.equal(serialized.includes('\u2028'), false);
  assert.equal(serialized.includes('\u2029'), false);
  assert.equal(serialized.toLowerCase().includes('</script>'), false);

  assert.deepEqual(JSON.parse(serialized), value);
});
