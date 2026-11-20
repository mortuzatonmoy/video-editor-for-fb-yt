import {cutRange,totalDuration,dimensions,presets,segmentArgs} from './edit-model.js';
import {FFmpeg} from './vendor/ffmpeg/index.js';
const $=id=>document.getElementById(id), player=$('player');
let media=[], clips=[], selected=null, history=[], future=[], preset='reels', busy=false, importing=false, sequence=false, engine=null, cancelled=false, downloadURL=null;
let serial=0, engineURLs=[], exportStep=0, exportSteps=1;
const uid=()=>`c${++serial}`;
const fmt=s=>{s=Math.max(0,s||0);return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toFixed(2).padStart(5,'0')}`;};
const selectedClip=()=>clips.find(c=>c.id===selected);
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function snapshot(){history.push(clips.map(c=>({...c})));if(history.length>80)history.shift();future=[];}
function invalidate(){if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL=null;}$('download').hidden=true;}
function pause(){sequence=false;player.pause();$('play').textContent='▶ Play edit';}
function setBusy(value){busy=value;document.body.classList.toggle('busy',value);$('cancel').hidden=!value;$('progress').hidden=!value;$('addTop').disabled=value;$('play').disabled=value||!clips.length;$('seek').disabled=value||!clips.length;$('export').disabled=value||!clips.length;}
function updateButtons(){for(const id of ['removeRange','split','markStart','markEnd'])$(id).disabled=!selectedClip()||busy;$('undo').disabled=!history.length||busy;$('redo').disabled=!future.length||busy;$('export').disabled=!clips.length||busy||importing;$('play').disabled=!clips.length||busy;$('seek').disabled=!selectedClip()||busy;}
function redraw(){
  $('clips').replaceChildren();
  if(!clips.length){const p=document.createElement('p');p.className='timelineEmpty';p.textContent='Your clips will appear here, in playback order.';$('clips').append(p);}
  clips.forEach((c,i)=>{
    const m=media.find(m=>m.id===c.mediaId), card=document.createElement('div');card.className='clip'+(c.id===selected?' selected':'');card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',`Clip ${i+1}: ${m.name}`);
    const title=document.createElement('strong');title.className='clipTitle';title.textContent=`${i+1}. ${m.name}`;
    const time=document.createElement('div');time.className='clipTime';time.textContent=`${fmt(c.start)} – ${fmt(c.end)} · ${fmt(c.end-c.start)}`;
    const actions=document.createElement('div');actions.className='clipActions';
    for(const [text,fn,disabled] of [['Earlier',()=>moveClip(i,-1),i===0],['Later',()=>moveClip(i,1),i===clips.length-1],['Delete',()=>deleteClip(c.id),false]]){const b=document.createElement('button');b.textContent=text;b.disabled=disabled||busy;b.onclick=e=>{e.stopPropagation();fn();};actions.append(b);}
    card.append(title,time,actions);card.onclick=()=>{if(!busy){pause();selectClip(c.id);}};card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===card){e.preventDefault();card.click();}};$('clips').append(card);
  });
  $('clipCount').textContent=`${clips.length} clips · ${fmt(totalDuration(clips))}`;
  $('emptyPreview').hidden=clips.length>0;
  updateButtons();updateTime();
}
function updateTime(){const c=selectedClip();const i=clips.indexOf(c);const before=i>=0?totalDuration(clips.slice(0,i)):0;const local=c?Math.min(c.end-c.start,Math.max(0,player.currentTime-c.start)):0;$('time').textContent=`${fmt(before+local)} / ${fmt(totalDuration(clips))}`;$('sourceTime').textContent=`Source time ${fmt(player.currentTime)}`;if(!player.seeking)$('seek').value=player.currentTime||0;}
function selectClip(id,play=false){
  const c=clips.find(c=>c.id===id);selected=c?.id??null;
  if(!c){player.pause();player.removeAttribute('src');player.load();$('sourceName').textContent='No clip selected';redraw();return;}
  const m=media.find(m=>m.id===c.mediaId);$('sourceName').textContent=m.name;$('seek').min=c.start;$('seek').max=c.end;$('cutStart').value=c.start.toFixed(2);$('cutEnd').value=c.end.toFixed(2);
  const seekAndPlay=()=>{player.currentTime=c.start;if(play)player.play().catch(e=>{pause();status('Playback could not start: '+e.message,true);});};
  if(player.dataset.mediaId!==String(m.id)){player.src=m.url;player.dataset.mediaId=m.id;player.onloadedmetadata=()=>{player.onloadedmetadata=null;seekAndPlay();};}else seekAndPlay();
  redraw();
}
function changed(){pause();invalidate();selectClip(clips.some(c=>c.id===selected)?selected:clips[0]?.id);status('Edit updated. Ready to export.');}
function moveClip(i,delta){if(busy)return;snapshot();[clips[i],clips[i+delta]]=[clips[i+delta],clips[i]];changed();}
function deleteClip(id){if(busy)return;snapshot();clips=clips.filter(c=>c.id!==id);changed();}
async function importFiles(files){
  if(busy||importing)return;importing=true;updateButtons();
  for(const file of files){
    if(media.reduce((s,m)=>s+m.file.size,0)+file.size>500*1024*1024){status('This workspace supports up to 500 MB total. Please choose a smaller video.',true);break;}
    const url=URL.createObjectURL(file), probe=document.createElement('video');probe.preload='metadata';probe.src=url;
    try{
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Video metadata timed out. Try MP4 (H.264).')),20000);probe.onloadedmetadata=()=>{clearTimeout(timeout);resolve();};probe.onerror=()=>{clearTimeout(timeout);reject(new Error('This browser cannot preview that video. Try MP4 (H.264) or WebM.'));};});
      if(!Number.isFinite(probe.duration)||probe.duration<.04||!probe.videoWidth)throw new Error('The selected file does not contain a playable video.');
      snapshot();const m={id:uid(),file,name:file.name,url,duration:probe.duration,width:probe.videoWidth,height:probe.videoHeight};media.push(m);const c={id:uid(),mediaId:m.id,start:0,end:m.duration};clips.push(c);pause();invalidate();renderMedia();selectClip(c.id);status(`${file.name} added.`);
    }catch(e){URL.revokeObjectURL(url);status(`${file.name}: ${e.message}`,true);}finally{probe.removeAttribute('src');probe.load();}
  }
  importing=false;$('files').value='';updateButtons();
}
function renderMedia(){
  $('mediaCount').textContent=`${media.length} files`;$('mediaList').replaceChildren();
  for(const m of media){const item=document.createElement('div');item.className='mediaItem';const name=document.createElement('strong');name.textContent=m.name;name.title=m.name;const meta=document.createElement('small');meta.textContent=`${fmt(m.duration)} · ${m.width} × ${m.height}`;const add=document.createElement('button');add.textContent='＋ Add to edit';add.onclick=()=>{if(busy)return;snapshot();const c={id:uid(),mediaId:m.id,start:0,end:m.duration};clips.push(c);selected=c.id;changed();};item.append(name,meta,add);$('mediaList').append(item);}
}
function updateFormat(){const p=presets[preset], [w,h]=dimensions(preset,$('quality').value);$('resolution').textContent=`${w} × ${h}`;$('previewLabel').textContent=`${p.ratio} · ${$('fit').value==='fit'?'Fit':'Center crop'}`;const frame=$('frame');frame.style.aspectRatio=`${p.width}/${p.height}`;frame.style.width=p.width>p.height?'100%':'auto';frame.style.height=p.width>p.height?'auto':'100%';player.style.objectFit=$('fit').value==='fit'?'contain':'cover';document.querySelectorAll('.preset').forEach(b=>{const active=b.dataset.preset===preset;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
$('files').onchange=e=>importFiles(e.target.files);$('addTop').onclick=$('dropzone').onclick=()=>$('files').click();
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('dragover');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragover');if(event==='drop')importFiles(e.dataTransfer.files);});
$('play').onclick=()=>{if(sequence){pause();return;}if(!clips.length)return;sequence=true;$('play').textContent='Ⅱ Pause';const c=selectedClip()||clips[0];if(player.currentTime>=c.end-.03||player.currentTime<c.start)selectClip(c.id,true);else player.play().catch(e=>{pause();status(e.message,true);});};
function nextClip(){if(!sequence)return;const i=clips.findIndex(c=>c.id===selected);if(i+1<clips.length)selectClip(clips[i+1].id,true);else{pause();selectClip(clips[0]?.id);}}
player.ontimeupdate=()=>{updateTime();const c=selectedClip();if(sequence&&c&&player.currentTime>=c.end-.035)nextClip();};player.onended=nextClip;
$('seek').oninput=()=>{pause();player.currentTime=Number($('seek').value);updateTime();};$('mutePreview').onchange=()=>{player.muted=$('mutePreview').checked;};
$('markStart').onclick=()=>{$('cutStart').value=player.currentTime.toFixed(2);};$('markEnd').onclick=()=>{$('cutEnd').value=player.currentTime.toFixed(2);};
$('removeRange').onclick=()=>{try{const c=selectedClip();let from=Number($('cutStart').value),to=Number($('cutEnd').value);if(Math.abs(from-c.start)<.011)from=c.start;if(Math.abs(to-c.end)<.011)to=c.end;const next=cutRange(clips,selected,from,to);snapshot();clips=next;changed();}catch(e){status(e.message,true);}};
$('split').onclick=()=>{const c=selectedClip(),t=player.currentTime;if(!c||t-c.start<.04||c.end-t<.04){status('Move the playhead inside the clip to split it.',true);return;}snapshot();clips=clips.flatMap(x=>x.id!==c.id?[x]:[{...x,id:uid(),end:t},{...x,id:uid(),start:t}]);changed();};
$('undo').onclick=()=>{if(!history.length)return;future.push(clips.map(c=>({...c})));clips=history.pop();changed();};$('redo').onclick=()=>{if(!future.length)return;history.push(clips.map(c=>({...c})));clips=future.pop();changed();};
document.querySelectorAll('.preset').forEach(b=>b.onclick=()=>{if(busy)return;preset=b.dataset.preset;invalidate();updateFormat();});$('fit').onchange=$('quality').onchange=()=>{invalidate();updateFormat();};
$('help').onclick=()=>$('guide').showModal();$('closeGuide').onclick=()=>$('guide').close();
async function getEngine(){
  if(engine?.loaded)return engine;
  const instance=new FFmpeg();engine=instance;status('Loading video engine (about 32 MB)…');
  const partsResponse=await fetch('./vendor/core-parts.json');if(!partsResponse.ok)throw new Error('Could not load video engine manifest.');const parts=await partsResponse.json();
  const buffers=[];for(let i=0;i<parts.length;i++){if(cancelled)throw new Error('Cancelled');const response=await fetch('./vendor/'+parts[i]);if(!response.ok)throw new Error('Could not download video engine. Please reload and try again.');buffers.push(await response.arrayBuffer());$('progress').value=(i+1)/parts.length*8;}
  if(cancelled)throw new Error('Cancelled');
  const wasmURL=URL.createObjectURL(new Blob(buffers,{type:'application/wasm'}));engineURLs.push(wasmURL);
  instance.on('progress',({progress})=>{$('progress').value=10+Math.min(1,Math.max(0,(exportStep+Math.max(0,Math.min(progress,1)))/exportSteps))*85;});
  await instance.load({coreURL:new URL('./vendor/core/ffmpeg-core.js',location.href).href,wasmURL});return instance;
}
async function runExport(){
  if(busy||!clips.length)return;pause();invalidate();cancelled=false;setBusy(true);$('progress').value=0;
  const job=clips.map(c=>({...c}));const [w,h]=dimensions(preset,$('quality').value),fit=$('fit').value;let f=null;const created=new Set();
  try{
    f=await getEngine();if(cancelled)throw new Error('Cancelled');exportSteps=job.length+1;const audioInfo=new Map();
    for(const id of new Set(job.map(c=>c.mediaId))){const m=media.find(m=>m.id===id),name=`source-${id}`;status(`Reading ${m.name}…`);await f.writeFile(name,new Uint8Array(await m.file.arrayBuffer()));created.add(name);const probe=`probe-${id}.json`;created.add(probe);const rc=await f.ffprobe(['-v','error','-select_streams','a','-show_entries','stream=index','-of','json','-o',probe,name]);if(rc!==0&&rc!==-1)throw new Error(`Could not inspect ${m.name}. Try an MP4 video.`);const info=JSON.parse(await f.readFile(probe,'utf8'));if(!Array.isArray(info.streams))throw new Error('Could not read audio metadata.');audioInfo.set(id,info.streams.length>0);}
    for(let i=0;i<job.length;i++){if(cancelled)throw new Error('Cancelled');exportStep=i;const c=job[i],out=`part-${i}.mp4`;created.add(out);status(`Rendering clip ${i+1} of ${job.length}… Keep this tab open.`);const rc=await f.exec(segmentArgs({input:`source-${c.mediaId}`,start:c.start,end:c.end,w,h,fit,audio:audioInfo.get(c.mediaId),output:out}));if(rc!==0)throw new Error('Video rendering failed. Try 720p or a smaller source file.');if(!job.slice(i+1).some(n=>n.mediaId===c.mediaId)){await f.deleteFile(`source-${c.mediaId}`);created.delete(`source-${c.mediaId}`);}}
    exportStep=job.length;status('Joining clips and preparing your MP4…');created.add('concat.txt');created.add('final.mp4');await f.writeFile('concat.txt',new TextEncoder().encode(job.map((_,i)=>`file 'part-${i}.mp4'`).join('\n')));const rc=await f.exec(['-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','-y','final.mp4']);if(rc!==0)throw new Error('Could not join the video clips.');
    const data=await f.readFile('final.mp4');downloadURL=URL.createObjectURL(new Blob([data],{type:'video/mp4'}));const link=$('download');link.href=downloadURL;link.download=`cutroom-${preset}-${w}x${h}.mp4`;link.textContent=`Download MP4 · ${(data.length/1024/1024).toFixed(1)} MB`;link.hidden=false;$('progress').value=100;status(`Your ${w} × ${h} video is ready. Download it below.`);
  }catch(e){if(cancelled)status('Export cancelled. Your edit is still here.');else{status(String(e.message||e)+' You can retry your export.',true);engine?.terminate();engine=null;}}finally{
    if(f?.loaded&&!cancelled)for(const name of created){try{await f.deleteFile(name);}catch{}}
    setBusy(false);updateButtons();
  }
}
$('export').onclick=runExport;$('cancel').onclick=()=>{cancelled=true;engine?.terminate();engine=null;for(const u of engineURLs)URL.revokeObjectURL(u);engineURLs=[];status('Cancelling export…');};
window.addEventListener('beforeunload',e=>{if(clips.length){e.preventDefault();e.returnValue='';}});
updateFormat();redraw();
