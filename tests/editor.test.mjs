import test from 'node:test';
import assert from 'node:assert/strict';
import {cutRange,totalDuration,dimensions,segmentArgs} from '../dist/edit-model.js';
const clip={id:'a',mediaId:'source',start:0,end:10};
test('removing the middle keeps both sides and preserves the next video',()=>{
  const input=[clip,{id:'b',mediaId:'second',start:2,end:6}];
  const result=cutRange(input,'a',3,7);
  assert.deepEqual(result.map(c=>[c.mediaId,c.start,c.end]),[['source',0,3],['source',7,10],['second',2,6]]);
  assert.equal(totalDuration(result),10);assert.equal(input[0].end,10);
});
test('cutting at either boundary or the whole clip leaves no zero length pieces',()=>{
  assert.deepEqual(cutRange([clip],'a',0,4).map(c=>[c.start,c.end]),[[4,10]]);
  assert.deepEqual(cutRange([clip],'a',6,10).map(c=>[c.start,c.end]),[[0,6]]);
  assert.deepEqual(cutRange([clip],'a',0,10),[]);
});
test('invalid ranges cannot silently corrupt an edit',()=>{
  for(const [start,end] of [[8,4],[-1,2],[2,11],[NaN,3],[2,2]])assert.throws(()=>cutRange([clip],'a',start,end));
});
test('preset dimensions are even and preserve the requested ratios',()=>{
  assert.deepEqual(dimensions('reels','1080'),[1080,1920]);
  assert.deepEqual(dimensions('feed','720'),[720,900]);
  assert.deepEqual(dimensions('youtube','720'),[1280,720]);
  assert.deepEqual(dimensions('square','1080'),[1080,1080]);
});
test('silent input receives an audio track for mixed-source concatenation',()=>{
  const args=segmentArgs({input:'in',start:1,end:3,w:720,h:1280,fit:'fit',audio:false,output:'out.mp4'});
  assert.ok(args.includes('1:a:0'));assert.ok(args.includes('anullsrc=channel_layout=stereo:sample_rate=48000'));
  assert.ok(args.includes('2.000000'));
});
