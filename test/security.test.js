import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionToken,validSession,limiter} from '../server/security.js';
test('sessions reject tampering, expiry, wrong secret and code rotation',() => {
  const token = sessionToken('secret','code',1000);
  assert.equal(validSession(token,'secret','code',2000),true);
  assert.equal(validSession(token+'x','secret','code',2000),false);
  assert.equal(validSession(token,'wrong','code',2000),false);
  assert.equal(validSession(token,'secret','rotated',2000),false);
  assert.equal(validSession(token,'secret','code',8*86400000),false);
  assert.equal(validSession(undefined,'secret','code'),false);
});
test('rate limits isolate callers and reset expired windows',() => {
  const allow = limiter(2,1000);
  assert.equal(allow('a',0),true);assert.equal(allow('a',1),true);assert.equal(allow('a',2),false);
  assert.equal(allow('b',3),true);assert.equal(allow('a',1000),true);
});
