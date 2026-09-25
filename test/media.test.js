import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {extractMedia,mediaReady} from '../server/recognition.js';
const available=await mediaReady();
test('real FFmpeg extracts eight JPEG frames and mono audio', {skip:!available}, async t => {
  const dir=await mkdtemp(path.join(tmpdir(),'kf-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const clip=path.join(dir,'clip.mp4');
  await promisify(execFile)(process.env.FFMPEG_PATH || 'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x240:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','2','-c:v','mpeg4','-c:a','aac',clip],{windowsHide:true});
  const media=await extractMedia(clip,dir);assert.equal(media.frames.length,8);assert.ok(media.audio.length>1000);assert.ok(media.duration>=2);assert.equal(media.frames[0][0],255);assert.equal(media.frames[0][1],216);
});
test('real FFprobe rejects a fake MP4', {skip:!available}, async t => {
  const dir=await mkdtemp(path.join(tmpdir(),'kf-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const clip=path.join(dir,'bad.mp4');await writeFile(clip,'not a video');await assert.rejects(extractMedia(clip,dir),{code:'INVALID_VIDEO'});
});
test('real FFmpeg accepts silent clips and rejects clips over 60 seconds', {skip:!available}, async t => {
  const dir=await mkdtemp(path.join(tmpdir(),'kf-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  for (const duration of [2,61]) {
    const work=path.join(dir,String(duration));await mkdir(work);
    const clip=path.join(work,'clip.mp4');await promisify(execFile)(process.env.FFMPEG_PATH || 'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=1','-t',String(duration),'-c:v','mpeg4',clip],{windowsHide:true});
    if(duration===2)assert.equal((await extractMedia(clip,work)).audio,null);else await assert.rejects(extractMedia(clip,work),{code:'VIDEO_LIMIT'});
  }
});
