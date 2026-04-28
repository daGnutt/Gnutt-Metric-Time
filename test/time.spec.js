const assert = require('assert');
const { computeGMT, computeStartOfYear } = require('../src/time');

function approxEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

(async () => {
  const start = computeStartOfYear(2026);
  console.log('Start of Year 2026 midpoint:', start && start.toISOString());
  if (!start) { console.error('startOfYear not computed'); process.exit(2); }

  const now = new Date();
  const res = computeGMT(now, { year0: new Date().getUTCFullYear(), precision: 3 });
  console.log('GMT:', res.formatted);
  if (!(res && typeof res.fraction === 'number')) { console.error('computeGMT returned invalid result'); process.exit(2); }

  console.log('Test passed');
  process.exit(0);
})();

