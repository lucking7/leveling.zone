const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createRuntimeDatabase } = require('../src/modules/database');
const { checkedBinResult, createMmdbAdapter } = require('../src/modules/database/adapters');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leveling-runtime-db-'));
  const versions = path.join(root, 'versions');
  fs.mkdirSync(versions);

  const writeVersion = (name, files) => {
    const directory = path.join(versions, name);
    fs.mkdirSync(directory);
    fs.writeFileSync(
      path.join(directory, 'manifest.json'),
      JSON.stringify({ version: `release-${name}` })
    );
    for (const [filename, value] of Object.entries(files)) {
      fs.writeFileSync(path.join(directory, filename), value);
    }
    return directory;
  };

  const activate = name => {
    const next = path.join(root, 'current.next');
    fs.symlinkSync(path.join('versions', name), next, 'dir');
    fs.renameSync(next, path.join(root, 'current'));
  };

  return { root, writeVersion, activate };
}

function database(id, filename = `${id}.db`) {
  return { id, filename, format: 'csv' };
}

function textAdapter(state, queryHook) {
  return {
    async open(filePath) {
      state.opens += 1;
      const value = fs.readFileSync(filePath, 'utf8');
      return {
        query: ip => (queryHook ? queryHook(value, ip) : { value, ip }),
        close() {
          state.closes += 1;
        },
      };
    },
  };
}

function withDatabaseEnvironment(run) {
  return async () => {
    const previous = process.env.MMDB_PATH;
    const files = fixture();
    process.env.MMDB_PATH = path.join(files.root, 'current');
    try {
      await run(files);
    } finally {
      if (previous === undefined) delete process.env.MMDB_PATH;
      else process.env.MMDB_PATH = previous;
      fs.rmSync(files.root, { recursive: true, force: true });
    }
  };
}

test('MMDB adapter rejects IPv6 before consulting an IPv4-only reader', async () => {
  const queries = [];
  const adapter = createMmdbAdapter(async () => ({
    metadata: { ipVersion: 4 },
    get(ip) {
      queries.push(ip);
      return { asn: 64500 };
    },
  }));
  const reader = await adapter.open('/unused', database('ipv4'));

  assert.deepEqual(await reader.query('192.0.2.1'), { asn: 64500 });
  await assert.rejects(async () => reader.query('2001:db8::1'), /IPv6 is not supported/);
  assert.deepEqual(queries, ['192.0.2.1']);
});

test('MMDB adapter rejects an empty lookup as a failed query', async () => {
  const adapter = createMmdbAdapter(async () => ({
    metadata: { ipVersion: 6 },
    get() {
      return null;
    },
  }));
  const reader = await adapter.open('/unused', database('empty'));
  await assert.rejects(async () => reader.query('192.0.2.1'), /no record/);
});

test('BIN sentinel responses are rejected as failed queries', () => {
  assert.throws(
    () => checkedBinResult({ countryLong: 'INVALID_IP_ADDRESS' }, 'IP2Location'),
    /no usable record/
  );
  assert.throws(
    () => checkedBinResult({ countryLong: 'MISSING FILE' }, 'IP2Proxy'),
    /no usable record/
  );
});

test(
  'pins one real snapshot, changes generation, and closes the superseded reader',
  withDatabaseEnvironment(async ({ writeVersion, activate }) => {
    writeVersion('v1', { 'sample.db': 'one' });
    writeVersion('v2', { 'sample.db': 'two' });
    activate('v1');

    const state = { opens: 0, closes: 0 };
    const runtime = createRuntimeDatabase({
      catalog: [database('sample')],
      adapters: { csv: textAdapter(state) },
    });

    const first = await runtime.queryDatabases('192.0.2.1');
    assert.equal(first.generation, 'release-v1');
    assert.equal(first.records.sample.value, 'one');

    fs.unlinkSync(path.join(process.env.MMDB_PATH));
    activate('v2');
    const second = await runtime.queryDatabases('192.0.2.1');
    assert.equal(second.generation, 'release-v2');
    assert.equal(second.records.sample.value, 'two');
    assert.deepEqual(state, { opens: 2, closes: 1 });

    await runtime.dispose();
    await runtime.dispose();
    assert.deepEqual(state, { opens: 2, closes: 2 });
  })
);

test(
  'does not close an old generation while its query is in flight',
  withDatabaseEnvironment(async ({ writeVersion, activate }) => {
    writeVersion('v1', { 'sample.db': 'one' });
    writeVersion('v2', { 'sample.db': 'two' });
    activate('v1');

    let releaseOld;
    let oldStarted;
    const started = new Promise(resolve => {
      oldStarted = resolve;
    });
    const gate = new Promise(resolve => {
      releaseOld = resolve;
    });
    const state = { opens: 0, closes: 0 };
    const runtime = createRuntimeDatabase({
      catalog: [database('sample')],
      adapters: {
        csv: textAdapter(state, async value => {
          if (value === 'one') {
            oldStarted();
            await gate;
          }
          return value;
        }),
      },
    });

    const oldQuery = runtime.queryDatabases('192.0.2.1');
    await started;
    fs.unlinkSync(path.join(process.env.MMDB_PATH));
    activate('v2');

    const newQuery = await runtime.queryDatabases('192.0.2.2');
    assert.equal(newQuery.records.sample, 'two');
    assert.equal(state.closes, 0);

    releaseOld();
    const oldResult = await oldQuery;
    assert.equal(oldResult.records.sample, 'one');
    assert.equal(oldResult.generation, 'release-v1');
    assert.equal(state.closes, 1);
    await runtime.dispose();
  })
);

test(
  'reports a missing database independently and retries a failed open',
  withDatabaseEnvironment(async ({ writeVersion, activate }) => {
    writeVersion('v1', { 'good.db': 'ready', 'retry.db': 'eventual' });
    activate('v1');

    let attempts = 0;
    const state = { opens: 0, closes: 0 };
    const retrying = textAdapter(state);
    const runtime = createRuntimeDatabase({
      catalog: [database('good'), database('missing'), database('retry')],
      adapters: {
        csv: {
          async open(filePath, definition) {
            if (definition.id === 'retry' && attempts++ === 0) throw new Error('temporary failure');
            return retrying.open(filePath, definition);
          },
        },
      },
    });

    const first = await runtime.queryDatabases('192.0.2.1');
    assert.equal(first.records.good.value, 'ready');
    assert.equal(first.errors.retry, 'Database unavailable');
    assert.equal(first.errors.missing, 'Database not installed');

    const second = await runtime.queryDatabases('192.0.2.1');
    assert.equal(second.records.retry.value, 'eventual');
    assert.equal(second.errors.retry, undefined);
    assert.equal(second.errors.missing, 'Database not installed');
    await runtime.dispose();
  })
);

test(
  'retires a cached reader when the new snapshot omits that database',
  withDatabaseEnvironment(async ({ writeVersion, activate }) => {
    writeVersion('v1', { 'sample.db': 'one', 'anchor.db': 'present' });
    writeVersion('v2', { 'anchor.db': 'present' });
    activate('v1');

    const state = { opens: 0, closes: 0 };
    const runtime = createRuntimeDatabase({
      catalog: [database('sample'), database('anchor')],
      adapters: { csv: textAdapter(state) },
    });
    await runtime.queryDatabases('192.0.2.1');

    fs.unlinkSync(path.join(process.env.MMDB_PATH));
    activate('v2');
    const result = await runtime.queryDatabases('192.0.2.1');
    assert.equal(result.errors.sample, 'Database not installed');
    assert.equal(result.records.anchor.value, 'present');
    assert.equal(state.closes, 2);
    await runtime.dispose();
  })
);

test(
  'a failed open wakes a concurrent dispose and can be retried',
  withDatabaseEnvironment(async ({ writeVersion, activate }) => {
    writeVersion('v1', { 'sample.db': 'one' });
    activate('v1');

    let releaseOpen;
    let openStarted;
    const started = new Promise(resolve => {
      openStarted = resolve;
    });
    const gate = new Promise(resolve => {
      releaseOpen = resolve;
    });
    let attempts = 0;
    const state = { opens: 0, closes: 0 };
    const succeeding = textAdapter(state);
    const runtime = createRuntimeDatabase({
      catalog: [database('sample')],
      adapters: {
        csv: {
          async open(filePath, definition) {
            if (attempts++ === 0) {
              openStarted();
              await gate;
              throw new Error('temporary failure');
            }
            return succeeding.open(filePath, definition);
          },
        },
      },
    });

    const query = runtime.queryDatabases('192.0.2.1');
    await started;
    const disposing = runtime.dispose();
    releaseOpen();
    const [failed] = await Promise.all([query, disposing]);
    assert.equal(failed.errors.sample, 'Database unavailable');

    const retried = await runtime.queryDatabases('192.0.2.1');
    assert.equal(retried.records.sample.value, 'one');
    await runtime.dispose();
  })
);

test(
  'dispose waits for active queries and releases each reader once',
  withDatabaseEnvironment(async ({ writeVersion, activate }) => {
    writeVersion('v1', { 'sample.db': 'one' });
    activate('v1');

    let releaseQuery;
    let queryStarted;
    const started = new Promise(resolve => {
      queryStarted = resolve;
    });
    const gate = new Promise(resolve => {
      releaseQuery = resolve;
    });
    const state = { opens: 0, closes: 0 };
    const runtime = createRuntimeDatabase({
      catalog: [database('sample')],
      adapters: {
        csv: textAdapter(state, async value => {
          queryStarted();
          await gate;
          return value;
        }),
      },
    });

    const query = runtime.queryDatabases('192.0.2.1');
    await started;
    let disposed = false;
    const disposing = runtime.dispose().then(() => {
      disposed = true;
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(disposed, false);
    assert.equal(state.closes, 0);

    releaseQuery();
    await query;
    await disposing;
    assert.equal(state.closes, 1);
  })
);
