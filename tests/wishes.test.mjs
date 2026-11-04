import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../app/api/wishes/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const actionSource = ts.transpileModule(readFileSync(new URL('../app/api/wishes/action/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup({ verified = true, flagged = false, unavailable = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_fuzzy_luke_cage.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) {
    const statement = db.prepare(sql);
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async all() { return { results: statement.all(...params) }; },
      async first() { return statement.get(...params); },
      async run() { return { meta: statement.run(...params) }; },
    };
  } };
  const env = { DB, TURNSTILE_SECRET: 'test-only-secret', TURNSTILE_SITE_KEY: 'test-only-site', OPENAI_API_KEY: 'test-only-key' };
  const calls = [];
  const mockFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('siteverify')) return Response.json({ success: verified });
    if (unavailable) return new Response('', { status: 503 });
    return Response.json({ results: [{ flagged }] });
  };
  function load(code) {
    const testModule = { exports: {} };
    new Function('require', 'module', 'exports', 'fetch', code)(
      name => name === 'cloudflare:workers' ? { env } : require(name), testModule, testModule.exports, mockFetch,
    );
    return testModule.exports;
  }
  return { route: load(source), action: load(actionSource), db, env, calls };
}
function request(body, extra = {}) {
  return new Request('https://example.test/api/wishes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, token: 'local-test-delete-token-with-enough-length', turnstile: 'local-test-proof', ...extra }) });
}

test('pagination traverses every approved letter once, including tied timestamps and future available_at', async () => {
  const { db, route } = setup();
  const insert = db.prepare('INSERT INTO wishes VALUES (?, ?, ?, ?, ?, 0, 0, ?)');
  for (let i = 0; i < 61; i++) insert.run(`wish-${String(i).padStart(3, '0')}`, 'A public wish for tomorrow.', 'approved', Math.floor(i / 5), 9999999999999, 'test-only');
  for (const status of ['held', 'hidden', 'deleted', 'rejected']) insert.run(status, 'Never expose this text.', status, 999, 1, 'test-only');
  const ids = [];
  let cursor = null;
  do {
    const response = await route.GET(new Request(`https://example.test/api/wishes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`));
    const page = await response.json();
    assert.ok(page.letters.length <= 24);
    assert.ok(page.letters.every(letter => letter.id.startsWith('wish-')));
    assert.ok(page.letters.every(letter => !('delete_hash' in letter)));
    ids.push(...page.letters.map(letter => letter.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(ids.length, 61);
  assert.equal(new Set(ids).size, 61);
  assert.equal((await route.GET(new Request('https://example.test/api/wishes?cursor=bad'))).status, 400);
  db.close();
});

test('verified multiline wish passes moderation and is immediately discoverable', async () => {
  const { db, route, calls } = setup();
  const body = '조금 느려도 괜찮아.\nA little wish for tomorrow.';
  const response = await route.POST(request(body));
  assert.equal(response.status, 201);
  const sent = await response.json();
  assert.equal(sent.status, 'approved');
  assert.ok(sent.availableAt <= Date.now());
  const page = await (await route.GET(new Request('https://example.test/api/wishes'))).json();
  assert.equal(page.letters[0].body, body);
  assert.equal(calls.length, 2);
  db.close();
});

test('missing or rejected bot proof never inserts a shared letter', async () => {
  for (const turnstile of [undefined, '', 'rejected-proof']) {
    const { db, route } = setup({ verified: false });
    const response = await route.POST(request('A wish for a peaceful tomorrow.', { turnstile }));
    assert.equal(response.status, 400);
    assert.equal(db.prepare('SELECT count(*) AS n FROM wishes').get().n, 0);
    db.close();
  }
});

test('flagged content and unavailable moderation remain held and invisible', async () => {
  for (const options of [{ flagged: true }, { unavailable: true }]) {
    const { db, route } = setup(options);
    const response = await route.POST(request('A test wish sent to the review queue.'));
    assert.equal((await response.json()).status, 'held');
    const page = await (await route.GET(new Request('https://example.test/api/wishes'))).json();
    assert.equal(page.letters.length, 0);
    db.close();
  }
});

test('missing review configuration keeps wishes held', async () => {
  const { db, route, env } = setup();
  delete env.OPENAI_API_KEY;
  assert.equal((await (await route.POST(request('A wish that still needs review.'))).json()).status, 'held');
  db.close();
});

test('report and withdrawal remove letters from the exhibition', async () => {
  const { db, route, action } = setup();
  const first = await (await route.POST(request('A temporary wish for the report check.'))).json();
  await action.POST(new Request('https://example.test/api/wishes/action', { method: 'POST', body: JSON.stringify({ id: first.id, action: 'report' }) }));
  assert.equal((await (await route.GET(new Request('https://example.test/api/wishes'))).json()).letters.length, 0);
  const second = await (await route.POST(request('A temporary wish for the withdrawal check.'))).json();
  const result = await action.POST(new Request('https://example.test/api/wishes/action', { method: 'POST', body: JSON.stringify({ id: second.id, action: 'delete', token: 'local-test-delete-token-with-enough-length' }) }));
  assert.equal(result.status, 200);
  assert.equal((await (await route.GET(new Request('https://example.test/api/wishes'))).json()).letters.length, 0);
  db.close();
});
