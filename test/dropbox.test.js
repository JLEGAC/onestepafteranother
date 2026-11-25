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

test('Weekly archive, revision conflicts and limited pruning',async()=>{
 localStorage.setItem('upa-dropbox-token',JSON.stringify({account_id:'test',access_token:'fake',expires_at:Date.now()+999999}));
 let head=null,content,archives=[],deleted=[],writes=[];
 const file=n=>({'.tag':'file',name:n,path_lower:'/backups/'+n.toLowerCase()});
 const expired=file('pas-a-pas.2020-01-01T12-00-00.bak.json');
 globalThis.fetch=async(url,o)=>{const ep=new URL(url).pathname,arg=JSON.parse(o.headers['Dropbox-API-Arg']||'null');
 if(ep.endsWith('/get_metadata'))return head?Response.json({rev:head}):Response.json({error_summary:'path/not_found/'},{status:409});
 if(ep.endsWith('/download'))return Response.json(content);
 if(ep.endsWith('/upload')){if(arg.path==='/pas-a-pas-latest.json'){assert.deepEqual(arg.mode,head?{'.tag':'update',update:head}:'add');head=(Number(head||0)+1).toString();content=JSON.parse(new TextDecoder().decode(o.body));}else archives.push(file(arg.path.split('/').pop()));writes.push(arg.path);return Response.json({rev:head});}
 if(ep.endsWith('/list_folder'))return Response.json({entries:archives,has_more:true,cursor:'more'});
 if(ep.endsWith('/continue'))return Response.json({entries:deleted.length?[]:[expired,file('pas-a-pas-avant-restauration-2020-01-01_12-00-00.json'),file('notes.json')],has_more:false});
 if(ep.endsWith('/delete_v2')){deleted.push(JSON.parse(o.body).path);return Response.json({});}throw Error(ep);};
 await saveDropboxSnapshot({v:1});await saveDropboxSnapshot({v:1});await saveDropboxSnapshot({v:2});
 assert.equal(archives.length,1);assert.match(archives[0].name,/^pas-a-pas\.\d{4}-.+\.bak\.json$/);assert.deepEqual(deleted,[expired.path_lower]);assert.equal(writes.length,3);
 head='other';content={data:{v:3}};await assert.rejects(saveDropboxSnapshot({v:4}),/a changé/);assert.equal(writes.length,3);
});
