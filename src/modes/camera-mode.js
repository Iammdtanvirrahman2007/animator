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
  if(!ctx.md||ctx.md.t!=='cameraPan')return false;
  const p=ctx.screen(e),camera=ctx.camera;
  camera.x=ctx.md.cx-(p[0]-ctx.md.x)/camera.zoom;
  camera.y=ctx.md.cy-(p[1]-ctx.md.y)/camera.zoom;
  ctx.render();
  return true;
 },
 pointerUp(ctx){
  if(!ctx.md||ctx.md.t!=='cameraPan')return false;
  ctx.md=null;
  ctx.ui();
  return true;
 },
 keydown(ctx,e){
  const k=e.key.toLowerCase(),camera=ctx.camera;
  if(!camera)return false;
  if(k==='g'){ctx.md={t:'cameraG',x:camera.x,y:camera.y};return true}
  if(k==='r'){ctx.md={t:'cameraR',r:camera.r};return true}
  if(k==='s'){ctx.md={t:'cameraS',zoom:camera.zoom};return true}
  if(k==='0'&&e.code==='Numpad0'){camera.view=!camera.view;ctx.render();ctx.ui();return true}
  return false;
 }
};