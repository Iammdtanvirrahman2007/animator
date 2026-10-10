export const cameraMode={
 id:'camera',
 label:'Camera Mode',
 icon:'▣',
 tools:[['select','▣','Camera frame / pan'],['pivot','⌖','Camera center']],
 panels:['Camera','Composition','Camera Animation'],
 shortcuts:{g:'move camera',r:'rotate camera',s:'zoom camera',numpad0:'toggle camera view'},
 help:'Blender-style camera view with pan, rotation, zoom, frame and composition guides.',
 enter(ctx){if(ctx.camera)ctx.camera.view=true},
 exit(ctx){},
 pointerDown(ctx,e){
  if(e.button)return false;
  const {camera,screen}=ctx;
  if(!camera)return false;
  const p=screen(e);
  ctx.md={t:'cameraPan',x:p[0],y:p[1],cx:camera.x,cy:camera.y};
  return true;
 },
 pointerMove(ctx,e){
  const md=ctx.md,camera=ctx.camera;
  if(!md||!camera)return false;
  const p=ctx.screen(e);
  if(!p)return false;
  if(md.t==='cameraPan'){
   const dx=p[0]-md.x,dy=p[1]-md.y;
   if((dx||dy)&&!md.historyAdded){ctx.snap?.();md.historyAdded=true}
   camera.x=md.cx-dx/camera.zoom;
   camera.y=md.cy-dy/camera.zoom;
   ctx.render();
   return true;
  }
  if(['cameraG','cameraR','cameraS'].includes(md.t)){
   if(!Number.isFinite(md.x)||!Number.isFinite(md.y)){md.x=p[0];md.y=p[1];return true}
   const dx=p[0]-md.x,dy=p[1]-md.y;
   if((dx||dy)&&!md.historyAdded){ctx.snap?.();md.historyAdded=true}
   if(md.t==='cameraG'){
    camera.x=md.cx-dx/camera.zoom;
    camera.y=md.cy-dy/camera.zoom;
   }else if(md.t==='cameraR')camera.r=md.r+dx*.5;
   else camera.zoom=Math.max(.05,Math.min(8,md.zoom*Math.exp(-dy*.01)));
   ctx.render();
   return true;
  }
  return false;
 },
 pointerUp(ctx){
  if(!ctx.md||!['cameraPan','cameraG','cameraR','cameraS'].includes(ctx.md.t))return false;
  ctx.md=null;
  ctx.ui();
  return true;
 },
 keydown(ctx,e){
  const k=e.key.toLowerCase(),camera=ctx.camera;
  if(!camera)return false;
  if(k==='escape'&&ctx.md&&['cameraPan','cameraG','cameraR','cameraS'].includes(ctx.md.t)){
   const md=ctx.md;
   if(md.t==='cameraPan'||md.t==='cameraG'){camera.x=md.cx;camera.y=md.cy}
   else if(md.t==='cameraR')camera.r=md.r;
   else if(md.t==='cameraS')camera.zoom=md.zoom;
   if(md.historyAdded)ctx.cancelSnap?.();
   ctx.md=null;ctx.render();ctx.ui();return true;
  }
  if(k==='g'){ctx.snap?.();ctx.md={t:'cameraG',x:null,y:null,cx:camera.x,cy:camera.y,historyAdded:true};return true}
  if(k==='r'){ctx.snap?.();ctx.md={t:'cameraR',x:null,y:null,r:camera.r,historyAdded:true};return true}
  if(k==='s'){ctx.snap?.();ctx.md={t:'cameraS',x:null,y:null,zoom:camera.zoom,historyAdded:true};return true}
  if(k==='0'&&e.code==='Numpad0'){camera.view=!camera.view;ctx.render();ctx.ui();return true}
  return false;
 }
};