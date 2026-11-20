export const presets = {
  reels: {label:'Reels / Shorts', width:1080, height:1920, ratio:'9:16'},
  feed: {label:'Facebook Feed', width:1080, height:1350, ratio:'4:5'},
  youtube: {label:'YouTube', width:1920, height:1080, ratio:'16:9'},
  square: {label:'Square', width:1080, height:1080, ratio:'1:1'}
};
export function cutRange(clips, id, from, to) {
  const clip = clips.find(c=>c.id===id);
  if (!clip || !Number.isFinite(from) || !Number.isFinite(to) || from < clip.start || to > clip.end || to-from < .04) throw new Error('Choose a valid range inside this clip (at least 0.04 seconds).');
  return clips.flatMap(c=>c.id!==id ? [{...c}] : [
    ...(from-c.start>=.04 ? [{...c,id:c.id+'a',end:from}] : []),
    ...(c.end-to>=.04 ? [{...c,id:c.id+'b',start:to}] : [])
  ]);
}
export function totalDuration(clips) {return clips.reduce((s,c)=>s+c.end-c.start,0);}
export function dimensions(preset, quality) {
  const p=presets[preset]; if(!p)throw new Error('Unknown format');
  const scale=quality==='720' ? 2/3 : 1;
  return [Math.round(p.width*scale/2)*2, Math.round(p.height*scale/2)*2];
}
export function videoFilter(w,h,fit) {
  return fit==='crop' ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p` : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p`;
}
export function segmentArgs({input,start,end,w,h,fit,audio,output}) {
  const d=(end-start).toFixed(6);
  const args=['-ss',start.toFixed(6),'-i',input];
  if(!audio)args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push('-t',d,'-map','0:v:0','-map',audio?'0:a:0':'1:a:0','-vf',videoFilter(w,h,fit),'-af','apad,aresample=48000,asetpts=PTS-STARTPTS','-c:v','libx264','-preset','ultrafast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-video_track_timescale','90000','-movflags','+faststart','-y',output);
  return args;
}
