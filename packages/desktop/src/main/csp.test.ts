import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cspFor } from './csp.js'

test('gli script inline sono ammessi solo nel manuale', () => {
  assert.match(cspFor('/manual/index.html'), /script-src 'self' 'unsafe-inline'/)
  for (const path of ['/index.html', '/assets/app.js', '/manual', '/manualefalso/x.html']) {
    assert.doesNotMatch(cspFor(path), /script-src[^;]*unsafe-inline/)
  }
})
