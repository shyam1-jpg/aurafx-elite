const assert = require('assert');
const ai = require('./ai-intelligence-service');

assert.throws(() => ai.normaliseContext({ symbol: 'BAD', timeframe: 'H1', price: 1 }), /Unsupported symbol/);
assert.throws(() => ai.normaliseContext({ symbol: 'EURUSD', timeframe: 'M1', price: 1 }), /Unsupported timeframe/);
const validated = ai.validate({ decision: 'REVIEW_BUY', grade: 'A', confidence: 180, news_risk: 'HIGH', entry: { recommended_risk_pct: 4 } });
assert.strictEqual(validated.confidence, 100);
assert.strictEqual(validated.entry.recommended_risk_pct, 0.5);
assert.strictEqual(validated.execution_eligible, false);
const failed = ai.failClosed('test');
assert.strictEqual(failed.decision, 'NO_TRADE');
assert.strictEqual(failed.execution_eligible, false);
assert.deepStrictEqual(ai.parseJson('```json\n{"decision":"NO_TRADE"}\n```'), { decision: 'NO_TRADE' });
console.log('AI intelligence safety tests passed');

(async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key-not-real';
  const result = await ai.analyze({
    symbol: 'XAUUSD', timeframe: 'H1', price: 2400, quoteLive: true,
    market: { mood: 'CAUTION' }, calendar: [], news: []
  }, {
    force: true,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify({
        decision: 'NO_TRADE', grade: 'NO_TRADE', confidence: 22,
        market_regime: 'Range', news_risk: 'MEDIUM', news_summary: 'Mixed context.',
        entry: { type: 'none', recommended_risk_pct: 0 }, failed_conditions: ['No confirmation']
      }) })
    })
  });
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.decision, 'NO_TRADE');
  assert.strictEqual(result.execution_eligible, false);
  console.log('Mocked OpenAI response test passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
