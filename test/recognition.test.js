import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHypotheses,rankCandidates,recognize} from '../server/recognition.js';
test('AI candidates are bounded and malformed fields are rejected',() => {
  assert.throws(() => normalizeHypotheses({}));
  assert.deepEqual(normalizeHypotheses({candidates:[{title:'x',year:2000,evidence:'x',strength:'certain'}]}),[]);
  assert.equal(normalizeHypotheses({candidates:Array(10).fill({title:'Test',year:null,evidence:'scene',strength:'weak'})}).length,3);
});
test('ranking prefers exact title/year, deduplicates and strips probability-like scores',() => {
  const hypothesis = {title:'Arrival',year:2016,evidence:'visual clue',strength:'moderate'};
  const sets = [{results:[{id:1,title:'Arrival',release_date:'1996-01-01'},{id:2,title:'Arrival',release_date:'2016-01-01'},{id:3,title:'Arrival',adult:true}]}];
  const ranked = rankCandidates([hypothesis,hypothesis],[sets[0],sets[0]]);
  assert.equal(ranked[0].id,2);assert.equal(ranked.length,2);assert.equal('score' in ranked[0],false);
  assert.equal(ranked[0].url,'https://www.themoviedb.org/movie/2');
});
test('pipeline sends frames and transcript to vision and searches catalog titles',async () => {
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (url,options) => {
    calls.push({url:String(url),options});
    if (String(url).includes('transcriptions')) return Response.json({text:'We used to look up at the sky.'});
    if (String(url).includes('/responses')) return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({candidates:[{title:'Interstellar',year:2014,evidence:'Space scene',strength:'moderate'}]})}]}]});
    return Response.json({results:[{id:157336,title:'Interstellar',release_date:'2014-11-05',poster_path:'/poster.jpg'}]});
  };
  try {
    const result = await recognize({frames:[Buffer.from('frame')],audio:Buffer.from('audio'),duration:5},'uz',{OPENAI_API_KEY:'test-key',TMDB_READ_ACCESS_TOKEN:'test-tmdb'});
    assert.equal(result.mode,'live');assert.equal(result.candidates[0].id,157336);
    const vision = JSON.parse(calls[1].options.body);
    assert.equal(vision.store,false);assert.equal(vision.text.format.strict,true);
    assert.match(vision.input[0].content[0].text,/look up/);
    assert.match(vision.input[0].content[1].image_url,/data:image\/jpeg;base64/);
    assert.equal(new URL(calls[2].url).searchParams.get('query'),'Interstellar');
  } finally {globalThis.fetch = previous;}
});
test('empty evidence yields unknown instead of fabricated demo results',async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"candidates":[]}'}]}]});
  try {const result = await recognize({frames:[Buffer.from('frame')],audio:null,duration:4},'en',{OPENAI_API_KEY:'test'});assert.equal(result.outcome,'unknown');assert.deepEqual(result.candidates,[]);} finally {globalThis.fetch=previous;}
});
test('provider errors never fall back to demo recognition',async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response('',{status:429});
  try {await assert.rejects(recognize({frames:[],audio:null,duration:5},'en',{OPENAI_API_KEY:'test'}),{code:'PROVIDER_LIMIT'});} finally {globalThis.fetch=previous;}
});
