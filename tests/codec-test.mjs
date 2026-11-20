// Integration test: run the exact browser WASM codec with synthetic audiovisual fixtures.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {segmentArgs} from '../dist/edit-model.js';
globalThis.self={location:{href:'http://localhost/ffmpeg-core.js'}};
const {default:createCore}=await import('../dist/vendor/core/ffmpeg-core.js');
const names=JSON.parse(readFileSync(new URL('../dist/vendor/core-parts.json',import.meta.url)));
const bytes=Buffer.concat(names.map(n=>readFileSync(new URL('../dist/vendor/'+n,import.meta.url))));
const core=await createCore({wasmBinary:bytes});
let logs=[];core.setLogger(({message})=>logs.push(message));
function exec(args){logs=[];core.exec(...args);const rc=core.ret;core.reset();assert.equal(rc,0,logs.slice(-15).join('\n'));}
function probe(file){logs=[];core.ffprobe('-v','error','-show_streams','-show_format','-of','json','-o','probe.json',file);console.log('probe return',core.ret,logs);core.reset();return JSON.parse(core.FS.readFile('probe.json',{encoding:'utf8'}));}
exec(['-f','lavfi','-i','color=c=red:s=320x180:r=30:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','red.mp4']);
exec(['-f','lavfi','-i','color=c=blue:s=180x320:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p','blue.mp4']);
exec(segmentArgs({input:'red.mp4',start:0,end:1,w:360,h:640,fit:'fit',audio:true,output:'part-0.mp4'}));
exec(segmentArgs({input:'red.mp4',start:2,end:3,w:360,h:640,fit:'fit',audio:true,output:'part-1.mp4'}));
exec(segmentArgs({input:'blue.mp4',start:.5,end:1.5,w:360,h:640,fit:'crop',audio:false,output:'part-2.mp4'}));
core.FS.writeFile('concat.txt',"file 'part-0.mp4'\nfile 'part-1.mp4'\nfile 'part-2.mp4'");
exec(['-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','result.mp4']);
const info=probe('result.mp4'),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
assert.equal(v.width,360);assert.equal(v.height,640);assert.equal(v.codec_name,'h264');assert.equal(a.codec_name,'aac');assert.equal(a.channels,2);assert.ok(Math.abs(Number(info.format.duration)-3)<.15);
exec(['-i','result.mp4','-f','null','-']);
mkdirSync(new URL('../test-output',import.meta.url),{recursive:true});
for(const name of ['red.mp4','blue.mp4','result.mp4'])writeFileSync(new URL('../test-output/'+name,import.meta.url),core.FS.readFile(name));
console.log(JSON.stringify({passed:true,video:v.codec_name,audio:a.codec_name,width:v.width,height:v.height,duration:info.format.duration,checks:'middle cut, two sources, mixed audio/silent input, fit/crop, MP4 decode'}));
