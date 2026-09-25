import { createHmac, timingSafeEqual } from 'node:crypto';

export function equal(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
export function sessionToken(secret, code, now = Date.now()) {
  const expiry = String(now + 7 * 86400000);
  const signature = createHmac('sha256', secret).update(`${expiry}:${code}`).digest('hex');
  return `${expiry}.${signature}`;
}
export function validSession(token, secret, code, now = Date.now()) {
  if (!secret || !code || typeof token !== 'string') return false;
  const [expiry, signature, extra] = token.split('.');
  if (extra || !/^\d+$/.test(expiry) || !signature || Number(expiry) <= now || Number(expiry) > now + 7 * 86400000) return false;
  return equal(signature, createHmac('sha256', secret).update(`${expiry}:${code}`).digest('hex'));
}
export function limiter(max, windowMs) {
  const buckets = new Map();
  return (key, now = Date.now()) => {
    for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k);
    const b = buckets.get(key) || { count: 0, until: now + windowMs };
    b.count++;
    buckets.set(key, b);
    return b.count <= max;
  };
}
