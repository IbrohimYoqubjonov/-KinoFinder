import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {access} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {PublicError} from '../server/recognition.js';
const env = {BETA_ACCESS_CODE:'test-private-code-12345',SESSION_SECRET:'test-session-secret-more-than-32-characters',OPENAI_API_KEY:'test',TMDB_READ_ACCESS_TOKEN:'test',NODE_ENV:'test'};
async function serve(t,options={}) {
  const server=createApp({env,mediaAvailable:true,...options}).listen(0,'127.0.0.1');await once(server,'listening');t.after(() => server.close());
  const url=`http://127.0.0.1:${server.address().port}`;
  const login=await fetch(`${url}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:env.BETA_ACCESS_CODE})});
  return {url,cookie:login.headers.get('set-cookie')?.split(';')[0]};
}
test('private endpoints require login; shell and manifest remain installable',async t => {
  const {url,cookie}=await serve(t);
  assert.equal((await fetch(`${url}/api/recognize`,{method:'POST'})).status,401);
  const status=await fetch(`${url}/api/status`,{headers:{cookie}});assert.equal((await status.json()).authenticated,true);assert.equal(status.headers.get('cache-control'),'no-store');
  const manifest=await fetch(`${url}/manifest.webmanifest`);assert.equal((await manifest.json()).display,'standalone');
  const shell=await fetch(url);assert.match(shell.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  for (const icon of ['icon-192','icon-512','maskable-512']) assert.equal((await fetch(`${url}/icons/${icon}.png`)).status,200);
});
test('cross-origin writes and wrong beta code are denied',async t => {
  const {url}=await serve(t);
  assert.equal((await fetch(`${url}/api/login`,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({code:env.BETA_ACCESS_CODE})})).status,403);
  assert.equal((await fetch(`${url}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"code":"wrong"}'})).status,401);
});
test('missing credentials fail closed without invoking recognition',async t => {
  const {url,cookie}=await serve(t,{env:{...env,OPENAI_API_KEY:''},identify:() => assert.fail('Must not run')});
  const res=await fetch(`${url}/api/recognize`,{method:'POST',headers:{cookie}});assert.equal(res.status,503);assert.equal((await res.json()).error,'RECOGNITION_NOT_CONFIGURED');
});
test('multipart processing produces candidates and deletes temporary files',async t => {
  let directory;
  const {url,cookie}=await serve(t,{extract:async (_file,dir) => {directory=dir;return {frames:[],duration:5};},identify:async () => ({candidates:[],mode:'live',outcome:'unknown'})});
  const form=new FormData();form.append('video',new Blob(['test'],{type:'video/mp4'}),'test.mp4');form.append('language','uz');
  const res=await fetch(`${url}/api/recognize`,{method:'POST',headers:{cookie},body:form});assert.equal(res.status,200);assert.equal((await res.json()).mode,'live');
  // The response can flush before finally finishes unlinking on Windows.
  for(let i=0;i<30;i++){try{await access(directory);await new Promise(r=>setTimeout(r,10));}catch{return;}}
  assert.fail('Temporary upload directory was not removed');
});
test('failed media processing also removes temporary upload',async t => {
  let directory;
  const {url,cookie}=await serve(t,{extract:async (_file,dir) => {directory=dir;throw new PublicError('INVALID_VIDEO');}});
  const form=new FormData();form.append('video',new Blob(['bad'],{type:'video/mp4'}),'bad.mp4');
  const res=await fetch(`${url}/api/recognize`,{method:'POST',headers:{cookie},body:form});assert.equal(res.status,400);
  for(let i=0;i<30;i++){try{await access(directory);await new Promise(r=>setTimeout(r,10));}catch{return;}}
  assert.fail('Failed upload was not removed');
});
test('beta code and session secret must meet minimum length',async t => {
  const {url}=await serve(t,{env:{...env,BETA_ACCESS_CODE:'short'}});
  const status=await (await fetch(`${url}/api/status`)).json();assert.equal(status.authReady,false);assert.equal(status.recognitionReady,false);
});
