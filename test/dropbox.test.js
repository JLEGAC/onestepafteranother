import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudConfig } from '../src/cloud/config.js';
import { connectDropbox, readDropboxSnapshot, saveDropboxSnapshot } from '../src/cloud/dropbox.js';

const savedGlobals = {};
let oldAppKey;

beforeEach(() => {
  savedGlobals.localStorage = globalThis.localStorage;
  savedGlobals.fetch = globalThis.fetch;
  savedGlobals.location = globalThis.location;
  oldAppKey = cloudConfig.dropboxAppKey;
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
});

afterEach(() => {
  cloudConfig.dropboxAppKey = oldAppKey;
  for (const key of ['localStorage', 'fetch', 'location']) {
    if (savedGlobals[key] === undefined) delete globalThis[key];
    else globalThis[key] = savedGlobals[key];
  }
});

test('Dropbox OAuth requests the scopes needed to list, download and save backups', async () => {
  cloudConfig.dropboxAppKey = 'test-app-key';
  globalThis.location = {
    origin: 'https://jlegac.github.io',
    pathname: '/onestepafteranother/',
    assign(url) { this.href = url; }
  };

  await connectDropbox();

  const authorization = new URL(globalThis.location.href);
  assert.deepEqual(
    authorization.searchParams.get('scope').split(' ').sort(),
    ['files.content.read', 'files.content.write', 'files.metadata.read'].sort()
  );
});

test('Dropbox download returns the snapshot text for one JSON parse', async () => {
  globalThis.localStorage.setItem('upa-dropbox-token', JSON.stringify({
    access_token: 'test-access-token',
    expires_at: Date.now() + 3_600_000
  }));
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://content.dropboxapi.com/2/files/download');
    assert.equal(options.method, 'POST');
    assert.equal(JSON.parse(options.headers['Dropbox-API-Arg']).path, '/pas-a-pas-latest.json');
    return new Response(JSON.stringify({ app: 'un-pas-apres-lautre', exportedAt: '2026-11-20T09:00:00.000Z', data: { stones: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' }
    });
  };

  const snapshot = await readDropboxSnapshot();
  assert.equal(snapshot.app, 'un-pas-apres-lautre');
  assert.deepEqual(snapshot.data, { stones: [] });
});

test('Dropbox saves and prunes dated versions across pages without deleting the latest copy or unrelated files', async () => {
  localStorage.setItem('upa-dropbox-token', JSON.stringify({
    access_token: 'test-access-token', expires_at: Date.now() + 3_600_000
  }));
  const file = name => ({ '.tag': 'file', name, path_lower: '/' + name.toLowerCase() });
  const versions = Array.from({length:20}, (_, i)=>file(`pas-a-pas-2020-01-${String(i+1).padStart(2,'0')}T09-00-00-000Z.json`));
  const uploaded = [], removed = [];
  globalThis.fetch = async (url, options) => {
    const endpoint = new URL(url).pathname;
    if (endpoint === '/2/files/upload') {
      assert.equal(JSON.parse(new TextDecoder().decode(options.body)).data.pillars[0].icon, '♡');
      uploaded.push(JSON.parse(options.headers['Dropbox-API-Arg']).path);
      return Response.json({});
    }
    if (endpoint === '/2/files/list_folder') return Response.json({
      entries:[file(uploaded[0].slice(1)),file('pas-a-pas-latest.json'),file('pas-a-pas-notes.json'),...versions.slice(10)], has_more:true,cursor:'next'
    });
    if (endpoint === '/2/files/list_folder/continue') {
      assert.equal(JSON.parse(options.body).cursor,'next');
      return Response.json({entries:versions.slice(0,10),has_more:false});
    }
    assert.equal(endpoint,'/2/files/delete_v2');
    removed.push(JSON.parse(options.body).path);
    return Response.json({});
  };
  await saveDropboxSnapshot({pillars:[{icon:'♡', iconColor:'purple'}]});
  assert.equal(uploaded[1], '/pas-a-pas-latest.json');
  assert.deepEqual(removed,[versions[0].path_lower]);
});
