import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallsign, validCallsign } from '../dist/pilot.js';
test('random callsigns use a fixed safe format and reject arbitrary display names', () => {
  for (let i = 0; i < 100; i++) assert.equal(validCallsign(createCallsign()), true);
  for (const value of [null, {}, '<script>', 'ADMIN', 'PILOT-00001', 'PILOT-AAAAAAAA<script>'])
    assert.equal(validCallsign(value), false);
});
