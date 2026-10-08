const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length3=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const n=length3(a)||1;return vmul(a,1/n)};

const state={
  yaw:.35,pitch:-.22,distance:900,target:[0,0,0],
  focal:720,grid:80,drawPlane:'XY',
  pageVisible:true,pageWidth:960,pageHeight:540,pageDepth:0,
  cameraPath:[],cameraPathSelected:-1,cameraPathDrawing:false,
  sceneCamera:{position:[0,0,720],target:[0,0,0],lens:50,show:true},
  selected:null,selectedPoint:-1,edit:false,
  transform:null,drag:null,gizmoSize:70,snap:.5
};

function ensure(S){
  if(!S.gp3d)S.gp3d={yaw:state.yaw,pitch:state.pitch,distance:state.distance,target:[0,0,0],focal:720,grid:80,active:true};
  state.yaw=S.gp3d.yaw??state.yaw;state.pitch=S.gp3d.pitch??state.pitch;
  state.distance=S.gp3d.distance??state.distance;state.target=[...(S.gp3d.target||[0,0,0])];
  state.focal=S.gp3d.focal||720;state.grid=S.gp3d.grid||80;
  state.pageVisible=S.gp3d.pageVisible!==false;state.pageWidth=S.gp3d.pageWidth||960;state.pageHeight=S.gp3d.pageHeight||540;state.pageDepth=S.gp3d.pageDepth||0;
  state.cameraPath=Array.isArray(S.gp3d.cameraPath)?S.gp3d.cameraPath.map(p=>[...p]):[];
  state.sceneCamera={position:[...(S.gp3d.sceneCamera?.position||[0,0,720])],target:[...(S.gp3d.sceneCamera?.target||[0,0,0])],lens:S.gp3d.sceneCamera?.lens||50,show:S.gp3d.sceneCamera?.show!==false};
}
function persist(S){
  if(!S.gp3d)S.gp3d={};
  Object.assign(S.gp3d,{yaw:state.yaw,pitch:state.pitch,distance:state.distance,target:[...state.target],focal:state.focal,grid:state.grid,pageVisible:state.pageVisible,pageWidth:state.pageWidth,pageHeight:state.pageHeight,pageDepth:state.pageDepth,cameraPath:state.cameraPath.map(p=>[...p]),sceneCamera:{position:[...state.sceneCamera.position],target:[...state.sceneCamera.target],lens:state.sceneCamera.lens,show:state.sceneCamera.show},active:true});
}
function camera(){
  const cp=Math.cos(state.pitch),sp=Math.sin(state.pitch),cy=Math.cos(state.yaw),sy=Math.sin(state.yaw);
  const pos=[state.target[0]+state.distance*cp*sy,state.target[1]+state.distance*sp,state.target[2]+state.distance*cp*cy];
  const forward=norm(vsub(state.target,pos));
  const worldUp=[0,1,0];
  let right=cross(forward,worldUp);
  if(length3(right)<.001)right=[Math.cos(state.yaw),0,-Math.sin(state.yaw)];
  right=norm(right);
  const up=norm(cross(right,forward));
  return{pos,forward,right,up};
}
function project(p){
  const cam=camera(),q=vsub(p,cam.pos),z=dot(q,cam.forward);
  if(z<=2)return null;
  const k=state.focal/z;
  return[480+dot(q,cam.right)*k,270-dot(q,cam.up)*k,z];
}
function rayFromScreen(x,y){
  const cam=camera(),nx=(x-480)/state.focal,ny=-(y-270)/state.focal;
  return{origin:cam.pos,dir:norm(vadd(cam.forward,vadd(vmul(cam.right,nx),vmul(cam.up,ny))))};
}
function planePoint(x,y,plane,fallback){
  const ray=rayFromScreen(x,y),axis=plane==='YZ'?0:plane==='XZ'?1:2,t=fallback??0;
  const d=ray.dir[axis];
  if(Math.abs(d)<1e-5)return fallbackPoint(ray,plane);
  return vadd(ray.origin,vmul(ray.dir,(t-ray.origin[axis])/d));
}
function fallbackPoint(ray,plane){
  const cam=camera(),d=ray.dir;
  if(plane==='XY')return[cam.target[0]+d[0]*120,cam.target[1]+d[1]*120,cam.target[2]];
  if(plane==='XZ')return[cam.target[0]+d[0]*120,cam.target[1],cam.target[2]+d[2]*120];
  return[cam.target[0],cam.target[1]+d[1]*120,cam.target[2]+d[2]*120];
}
function worldFromStroke(s){
  if(Array.isArray(s.gp3)&&s.gp3.length)return s.gp3[0];
  const z=Number.isFinite(+s.z)?+s.z:0;
  return[(s.p?.[0]?.[0]??480)-480,270-(s.p?.[0]?.[1]??270),z];
}
function worldPoints(s){
  if(Array.isArray(s.gp3)&&s.gp3.length)return s.gp3;
  const w=worldFromStroke(s);return(s.p||[]).map(()=>[...w]);
}
function strokeCenter(s){
  const pts=worldPoints(s);if(!pts.length)return[0,0,0];
  return pts.reduce((a,p)=>vadd(a,p),[0,0,0]).map(v=>v/pts.length);
}
function drawPage(c){
  if(!state.pageVisible)return;
  const z=state.pageDepth,w=state.pageWidth/2,h=state.pageHeight/2;
  const corners=[[-w,-h,z],[w,-h,z],[w,h,z],[-w,h,z]];
  const p=corners.map(project);
  if(p.some(x=>!x))return;
  c.save();
  c.fillStyle='#fbfaf7';
  c.globalAlpha=.88;
  c.beginPath();c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);c.closePath();c.fill();
  c.globalAlpha=.55;c.strokeStyle='#7b7d80';c.lineWidth=1.5;
  c.beginPath();c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);c.closePath();c.stroke();
  c.globalAlpha=.65;c.fillStyle='#555';c.font='10px system-ui';
  const label=project([0,-h+18,z]);
  if(label)c.fillText('2D ANIMATION PAGE',label[0]-58,label[1]);
  c.restore();
}
function drawSceneCamera(c){
  if(!state.sceneCamera.show)return;
  const cam=state.sceneCamera, pos=cam.position, target=cam.target;
  const f=norm(vsub(target,pos)), upRef=[0,1,0];
  let right=norm(cross(f,upRef)); if(length3(right)<.01)right=[1,0,0];
  const up=norm(cross(right,f));
  const near=90, far=180, halfH=far*.30, halfW=halfH*1.777;
  const nearC=vadd(pos,vmul(f,near)), farC=vadd(pos,vmul(f,far));
  const nc=[
    vadd(vadd(nearC,vmul(right,-halfW*.5)),vmul(up,halfH*.5)),
    vadd(vadd(nearC,vmul(right, halfW*.5)),vmul(up,halfH*.5)),
    vadd(vadd(nearC,vmul(right, halfW*.5)),vmul(up,-halfH*.5)),
    vadd(vadd(nearC,vmul(right,-halfW*.5)),vmul(up,-halfH*.5))
  ];
  const fc=[
    vadd(vadd(farC,vmul(right,-halfW)),vmul(up,halfH)),
    vadd(vadd(farC,vmul(right, halfW)),vmul(up,halfH)),
    vadd(vadd(farC,vmul(right, halfW)),vmul(up,-halfH)),
    vadd(vadd(farC,vmul(right,-halfW)),vmul(up,-halfH))
  ];
  const pp=p=>project(p);
  const P=nc.map(pp),Q=fc.map(pp),O=pp(pos);
  if(!O||P.some(x=>!x)||Q.some(x=>!x))return;
  c.save();c.strokeStyle='#ff9f32';c.fillStyle='#ff9f32';c.lineWidth=2;
  c.beginPath();c.moveTo(P[0][0],P[0][1]);for(let i=1;i<4;i++)c.lineTo(P[i][0],P[i][1]);c.closePath();c.stroke();
  c.beginPath();c.moveTo(Q[0][0],Q[0][1]);for(let i=1;i<4;i++)c.lineTo(Q[i][0],Q[i][1]);c.closePath();c.stroke();
  for(let i=0;i<4;i++){c.beginPath();c.moveTo(P[i][0],P[i][1]);c.lineTo(Q[i][0],Q[i][1]);c.stroke()}
  c.beginPath();c.arc(O[0],O[1],10,0,Math.PI*2);c.fill();
  c.fillStyle='#202124';c.font='bold 10px system-ui';c.fillText('CAMERA',O[0]+13,O[1]-12);
  c.fillStyle='#ffcf8a';c.font='9px system-ui';c.fillText('50mm',O[0]+13,O[1]+1);
  c.restore();
}
function drawCameraPath(c){
  if(state.cameraPath.length<1)return;
  const pts=state.cameraPath.map(project);
  c.save();c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='#f0a040';c.lineWidth=3;
  c.setLineDash([8,5]);
  c.beginPath();
  let started=false;
  for(const p of pts){if(!p)continue;if(!started){c.moveTo(p[0],p[1]);started=true}else c.lineTo(p[0],p[1])}
  if(started)c.stroke();
  c.setLineDash([]);
  pts.forEach((p,i)=>{
    if(!p)return;
    c.fillStyle=i===state.cameraPathSelected?'#fff':'#f0a040';
    c.strokeStyle='#222';c.lineWidth=2;c.beginPath();c.arc(p[0],p[1],i===state.cameraPathSelected?7:5,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#f0a040';c.font='9px system-ui';c.fillText(String(i+1),p[0]+7,p[1]-7);
  });
  c.restore();
}
function drawGrid(c){
  c.save();c.lineWidth=1;
  const g=state.grid;
  for(let z=-1200;z<=1200;z+=g){
    const a=project([-1200,0,z]),b=project([1200,0,z]);
    if(a&&b){c.strokeStyle='#ffffff0c';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke()}
  }
  for(let x=-1200;x<=1200;x+=g){
    const a=project([x,0,-1200]),b=project([x,0,1200]);
    if(a&&b){c.strokeStyle='#ffffff0c';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke()}
  }
  const axes=[
    [[-1400,0,0],[1400,0,0],'#d85c5c','X'],
    [[0,-1400,0],[0,1400,0],'#70c080','Y'],
    [[0,0,-1400],[0,0,1400],'#5d8fd3','Z']
  ];
  for(const[a,b,col]of axes){
    const p=project(a),q=project(b);if(!p||!q)continue;
    c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(q[0],q[1]);c.stroke();
  }
  const o=project([0,0,0]);
  if(o){c.fillStyle='#ddd';c.font='10px system-ui';c.fillText('X',Math.min(944,o[0]+6),o[1]-4);c.fillText('Y',o[0]+6,Math.max(12,o[1]-8));c.fillText('Z',o[0]+6,o[1]+14)}
  c.restore();
}
function hitStroke(s,x,y){
  const pts=worldPoints(s).map(project).filter(Boolean);let best=null,d=Infinity;
  for(let i=0;i<pts.length;i++){const q=Math.hypot(pts[i][0]-x,pts[i][1]-y);if(q<d){d=q;best=i}}
  return d<16?{index:best,d}:null;
}
function selectedStroke(){return state.selected?.s||null}
function polygonArea(pts){
  let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1]}return Math.abs(a)*.5;
}
function pointInPolygon(x,y,pts){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[i],b=pts[j],hit=((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/((b[1]-a[1])||1e-9)+a[0]);
    if(hit)inside=!inside;
  }
  return inside;
}
function fillCandidate(s,x,y){
  const pts=worldPoints(s).map(project).filter(Boolean).map(p=>[p[0],p[1]]);
  if(pts.length<3||polygonArea(pts)<8)return null;
  const end=Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1]);
  if(end>22)return null;
  return pointInPolygon(x,y,pts)?pts:null;
}
function bucketFill(ctx,x,y){
  const S=ctx.S;let best=null;
  for(let li=0;li<S.l.length;li++){
    const L=S.l[li];if(!L.v)continue;
    for(const s of L.d?.[S.f]||[]){
      const pts=fillCandidate(s,x,y);if(!pts)continue;
      const c=strokeCenter(s),z=Math.abs(c[2]);
      if(!best||pts.length>best.pts.length)best={s,li,pts,z};
    }
  }
  if(!best){ctx.ui?.();return false}
  ctx.snap?.();
  best.s.f=true;
  best.s.fc=ctx.col?.value||best.s.c||'#1b1b1b';
  best.s.fillRule='bucket';
  state.selected={s:best.s,li:best.li,h:{index:0,d:0}};
  state.selectedPoint=0;
  ctx.ui?.();ctx.render();
  return true;
}
function drawStroke(c,s){
  if(!s.p?.length)return;
  const pts=worldPoints(s).map(project).filter(Boolean);if(!pts.length)return;
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
  const z=pts.reduce((a,p)=>a+p[2],0)/pts.length;
  c.lineWidth=Math.max(.6,(s.w||1)*Math.max(.3,720/z));c.lineCap=c.lineJoin='round';
  c.strokeStyle=s.c||'#111';c.globalAlpha=Number.isFinite(+s.o)?+s.o:.98;c.stroke();
  if(s.f&&pts.length>2){c.save();c.globalAlpha*=Number.isFinite(+s.fo)?+s.fo:.22;c.fillStyle=s.fc||s.c||'#111';c.fill();c.restore()}
}
function drawSelection(c,S){
  const s=selectedStroke();if(!s)return;
  const pts=worldPoints(s).map(project).filter(Boolean);if(!pts.length)return;
  const box=pts.reduce((a,p)=>({minX:Math.min(a.minX,p[0]),minY:Math.min(a.minY,p[1]),maxX:Math.max(a.maxX,p[0]),maxY:Math.max(a.maxY,p[1])}),{minX:pts[0][0],minY:pts[0][1],maxX:pts[0][0],maxY:pts[0][1]});
  c.save();c.strokeStyle='#f0a040';c.lineWidth=1.5;c.setLineDash([6,4]);
  c.strokeRect(box.minX-7,box.minY-7,box.maxX-box.minX+14,box.maxY-box.minY+14);c.setLineDash([]);
  for(let i=0;i<pts.length;i++){c.fillStyle=i===state.selectedPoint?'#fff':'#f0a040';c.beginPath();c.arc(pts[i][0],pts[i][1],i===state.selectedPoint?5:3,0,Math.PI*2);c.fill()}
  c.restore();
}
function drawGizmo(c){
  const s=selectedStroke();if(!s)return;
  const center=project(strokeCenter(s));if(!center)return;
  const cam=camera(),axes=[
    {name:'x',v:[1,0,0],col:'#e05b5b'},
    {name:'y',v:[0,1,0],col:'#62c978'},
    {name:'z',v:[0,0,1],col:'#5c8fe0'}
  ];
  c.save();c.lineCap='round';c.lineWidth=4;
  for(const a of axes){
    const q=project(vadd(strokeCenter(s),vmul(a.v,state.gizmoSize/Math.max(.2,state.focal/Math.max(1,state.distance)))));
    if(!q)continue;
    c.strokeStyle=a.col;c.beginPath();c.moveTo(center[0],center[1]);c.lineTo(q[0],q[1]);c.stroke();
    const ang=Math.atan2(q[1]-center[1],q[0]-center[0]),r=8;
    c.fillStyle=a.col;c.beginPath();c.moveTo(q[0],q[1]);c.lineTo(q[0]-r*Math.cos(ang-.45),q[1]-r*Math.sin(ang-.45));c.lineTo(q[0]-r*Math.cos(ang+.45),q[1]-r*Math.sin(ang+.45));c.closePath();c.fill();
    c.font='bold 11px system-ui';c.fillText(a.name.toUpperCase(),q[0]+6,q[1]-6);
  }
  c.fillStyle='#f5f5f5';c.strokeStyle='#222';c.lineWidth=2;c.beginPath();c.arc(center[0],center[1],6,0,Math.PI*2);c.fill();c.stroke();
  c.restore();
}
function drawOnion(c,S,f){
  if(!S.on||S.f<=1)return;
  const K=S.l.flatMap(L=>{const a=L.d?.[f-1]||[],b=L.d?.[f+1]||[];return[...a.map(s=>({s,col:'#5d9cff'})),...b.map(s=>({s,col:'#ff6b9d'}))]});
  c.save();c.globalAlpha=.22;for(const q of K){const old=q.s.c;q.s.c=q.col;drawStroke(c,q.s);q.s.c=old}c.restore();
}
function draw(ctx,S,f,on){
  ensure(S);ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#202124';ctx.fillRect(0,0,960,540);
  drawPage(ctx);drawGrid(ctx);drawSceneCamera(ctx);drawCameraPath(ctx);drawOnion(ctx,S,f);
  const ordered=[];S.l.forEach((L,i)=>{if(!L.v)return;for(const s of L.d?.[f]||[])ordered.push({s,i,z:Number.isFinite(+s.z)?+s.z:(Number.isFinite(+L.gpZ)?+L.gpZ:i*45)})});
  ordered.sort((a,b)=>b.z-a.z);for(const q of ordered)drawStroke(ctx,q.s);
  drawSelection(ctx,S);if(state.edit)drawGizmo(ctx);
  ctx.fillStyle='#d9d9d9';ctx.font='11px system-ui';ctx.fillText('3D Grease Pencil',14,20);
  ctx.fillStyle='#9fa4aa';ctx.fillText('MMB Orbit · Shift+MMB Pan · Wheel Dolly · G/R/S · X/Y/Z constrain · Tab Edit',14,38);
  ctx.fillText('Plane '+state.drawPlane+' · Numpad 1/3/7/0 · [ ] depth · Shift+D duplicate · Delete remove',14,54);
  ctx.fillText('Orange CAMERA = scene camera · dashed line = camera path',14,70);
  ctx.restore();
}
function screen(e){
  const r=e.currentTarget.getBoundingClientRect();
  return[(e.clientX-r.left)*960/r.width,(e.clientY-r.top)*540/r.height];
}
function beginTransform(ctx,type,axis=null,e){
  const s=selectedStroke();if(!s)return false;
  ctx.snap?.();state.transform={type,axis,x:e.clientX,y:e.clientY,original:JSON.stringify(s),center:strokeCenter(s)};
  return true;
}
function axisVector(axis){return axis==='x'?[1,0,0]:axis==='y'?[0,1,0]:axis==='z'?[0,0,1]:null}
function transformStroke(s,type,dx,dy,axis){
  const center=strokeCenter(s),cam=camera();
  if(type==='g'){
    let delta=vadd(vmul(cam.right,-dx/state.distance*1.6),vmul(cam.up,dy/state.distance*1.6));
    const av=axisVector(axis);if(av){const amount=dot(delta,av);delta=vmul(av,amount)}
    if(state.snap){delta=delta.map(v=>Math.round(v/state.snap)*state.snap)}
    s.gp3=s.gp3.map(p=>vadd(p,delta));
  }else if(type==='s'){
    const factor=Math.max(.02,Math.exp(-dy*.006));
    s.gp3=s.gp3.map(p=>vadd(center,vmul(vsub(p,center),factor)));
  }else if(type==='r'){
    const amount=-dx*.008;
    const av=axisVector(axis)||[0,1,0],u=norm(av);
    s.gp3=s.gp3.map(p=>{
      const q=vsub(p,center),co=Math.cos(amount),si=Math.sin(amount);
      return vadd(center,vadd(vadd(vmul(q,co),vmul(cross(u,q),si)),vmul(u,dot(u,q)*(1-co))));
    });
  }
}
function gizmoHit(x,y){
  const s=selectedStroke();if(!s)return null;const c=project(strokeCenter(s));if(!c)return null;
  const scale=state.gizmoSize/Math.max(.2,state.focal/Math.max(1,state.distance));
  for(const axis of['x','y','z']){
    const q=project(vadd(strokeCenter(s),vmul(axisVector(axis),scale)));if(!q)continue;
    const dx=q[0]-c[0],dy=q[1]-c[1],l=Math.hypot(dx,dy)||1;
    const t=cl(((x-c[0])*dx+(y-c[1])*dy)/(l*l),0,1);
    if(Math.hypot(x-(c[0]+t*dx),y-(c[1]+t*dy))<11)return axis;
  }
  if(Math.hypot(x-c[0],y-c[1])<12)return 'center';
  return null;
}
function enter(ctx){ensure(ctx.S);ctx.S.gp3d.active=true;persist(ctx.S)}
function exit(ctx){if(ctx.S?.gp3d)persist(ctx.S);state.transform=null;state.selected=null;state.selectedPoint=-1}
function pointerDown(ctx,e){
  if(e.button===1){
    ctx.md={t:e.shiftKey?'gpPan':'gpOrbit',x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,target:[...state.target]};
    return true;
  }
  if(e.button!==0)return false;
  const S=ctx.S,[sx,sy]=screen(e);
  if((ctx.tool==='select'||ctx.tool==='edit')&&state.edit){
    const gh=gizmoHit(sx,sy);
    if(gh&&state.selected?.s){
      if(gh==='center')return beginTransform(ctx,'g',null,e);
      return beginTransform(ctx,'g',gh,e);
    }
  }
  if(ctx.tool==='cameraPath'){
    const w=planePoint(sx,sy,'XY',0);
    if(e.shiftKey){
      state.cameraPath=[];
    }
    state.cameraPath.push(w);
    state.cameraPathSelected=state.cameraPath.length-1;
    persist(ctx.S);ctx.ui?.();ctx.render();return true;
  }
  if(ctx.tool==='fill'){
    bucketFill(ctx,sx,sy);
    return true;
  }
  if(ctx.tool==='select'||ctx.tool==='edit'){
    let best=null;
    for(let li=0;li<S.l.length;li++){
      const L=S.l[li];if(!L.v)continue;
      for(const s of L.d?.[S.f]||[]){const h=hitStroke(s,sx,sy);if(h&&(!best||h.d<best.h.d))best={s,li,h}}
    }
    if(best){
      state.selected=best;state.selectedPoint=best.h.index;
      if(ctx.tool==='edit'||state.edit)state.edit=true;
      if(ctx.tool==='edit'){ctx.md={t:'gpPoint',s:best.s,index:best.h.index};}
    }else if(!e.shiftKey){state.selected=null;state.selectedPoint=-1}
    ctx.ui?.();ctx.render();return true;
  }
  const L=S.l[S.i];if(!L||!L.v)return true;
  const w=planePoint(sx,sy,state.drawPlane),a=[w[0]+480,270-w[1]];
  if(!(S.f in L.d))L.d[S.f]=[];
  ctx.snap?.();
  const s={c:ctx.col?.value||'#1b1b1b',w:+(ctx.sz?.value||4),f:!!ctx.fl?.checked,p:[[a[0],a[1]]],z:Number.isFinite(+L.gpZ)?+L.gpZ:S.i*45,plane:state.drawPlane,gp3:[w]};
  L.d[S.f].push(s);state.selected={s,li:S.i,h:{index:0,d:0}};state.selectedPoint=0;
  ctx.md={t:'gpDraw',L,s};ctx.render();return true;
}
function pointerMove(ctx,e){
  if(state.transform){
    const t=state.transform,dx=e.clientX-t.x,dy=e.clientY-t.y,s=selectedStroke();
    if(s){transformStroke(s,t.type,dx,dy,t.axis);persist(ctx.S);ctx.render();return true}
  }
  if(ctx.md?.t==='gpPoint'&&state.selected?.s){
    const [sx,sy]=screen(e),s=state.selected.s,w=planePoint(sx,sy,s.plane||state.drawPlane);
    s.gp3[state.selectedPoint]=w;
    if(s.p[state.selectedPoint])s.p[state.selectedPoint]=[w[0]+480,270-w[1]];
    persist(ctx.S);ctx.render();return true;
  }
  if(ctx.md?.t==='gpOrbit'){
    state.yaw=ctx.md.yaw-(e.clientX-ctx.md.x)*.008;state.pitch=clamp(ctx.md.pitch+(e.clientY-ctx.md.y)*.006,-1.45,1.45);
    persist(ctx.S);ctx.render();return true;
  }
  if(ctx.md?.t==='gpPan'){
    const scale=Math.max(.05,state.distance/720),dx=(e.clientX-ctx.md.x)*scale,dy=(e.clientY-ctx.md.y)*scale,cam=camera();
    state.target=vadd(ctx.md.target,vadd(vmul(cam.right,-dx),vmul(cam.up,dy)));persist(ctx.S);ctx.render();return true;
  }
  if(ctx.md?.t==='gpDraw'){
    const [sx,sy]=screen(e),s=ctx.md.s,w=planePoint(sx,sy,s.plane||state.drawPlane),a=[w[0]+480,270-w[1]],p=s.p,g=s.gp3,last=p[p.length-1];
    if(Math.hypot(a[0]-last[0],a[1]-last[1])>1.2){p.push(a);g.push(w)}
    persist(ctx.S);ctx.render();return true;
  }
  return false;
}
function pointerUp(ctx){
  if(state.transform){state.transform=null;ctx.ui?.();persist(ctx.S);return true}
  if(ctx.md?.t==='gpDraw')ctx.ui?.();
  if(ctx.md)ctx.md=null;return !!ctx.md;
}
function wheel(ctx,e){
  e.preventDefault();state.distance=clamp(state.distance*(e.deltaY>0?1.1:.9),100,6000);persist(ctx.S);ctx.render();return true;
}
function duplicateSelected(ctx){
  const s=selectedStroke(),L=ctx.S.l[state.selected?.li??ctx.S.i];if(!s||!L)return;
  ctx.snap?.();const copy=JSON.parse(JSON.stringify(s));copy.gp3=copy.gp3.map(p=>[p[0]+24,p[1]+10,p[2]+12]);copy.p=copy.gp3.map(p=>[p[0]+480,270-p[1]]);
  L.d[ctx.S.f]=(L.d[ctx.S.f]||[]).concat(copy);state.selected={s:copy,li:state.selected?.li??ctx.S.i,h:{index:0,d:0}};state.selectedPoint=0;ctx.ui?.();ctx.render();
}
function deleteSelected(ctx){
  const s=selectedStroke(),q=state.selected;if(!s||!q)return;
  const L=ctx.S.l[q.li],a=L?.d?.[ctx.S.f];if(!a)return;
  const i=a.indexOf(s);if(i<0)return;ctx.snap?.();a.splice(i,1);state.selected=null;state.selectedPoint=-1;ctx.ui?.();ctx.render();
}
function keydown(ctx,e){
  const k=e.key.toLowerCase();
  if(state.transform){
    if(k==='x'||k==='y'||k==='z'){state.transform.axis=state.transform.axis===k?null:k;ctx.ui?.();ctx.render();return true}
    if(k==='enter'){state.transform=null;ctx.ui?.();persist(ctx.S);return true}
    if(k==='escape'){
      const old=JSON.parse(state.transform.original),s=selectedStroke();
      if(s){for(const key of Object.keys(s))delete s[key];Object.assign(s,old)}
      state.transform=null;ctx.ui?.();ctx.render();return true
    }
  }
  if(k==='1'&&e.code==='Numpad1'){state.yaw=0;state.pitch=0;persist(ctx.S);ctx.render();return true}
  if(k==='3'&&e.code==='Numpad3'){state.yaw=Math.PI/2;state.pitch=0;persist(ctx.S);ctx.render();return true}
  if(k==='7'&&e.code==='Numpad7'){state.yaw=0;state.pitch=Math.PI/2-.001;persist(ctx.S);ctx.render();return true}
  if(k==='0'&&e.code==='Numpad0'){state.yaw=.35;state.pitch=-.22;persist(ctx.S);ctx.render();return true}
  if(k==='x'||k==='y'||k==='z'){state.drawPlane=k==='x'?'YZ':k==='y'?'XZ':'XY';ctx.ui?.();ctx.render();return true}
  if(k==='tab'){state.edit=!state.edit;ctx.ui?.();ctx.render();return true}
  if(k==='f'){ctx.tool='fill';ctx.ui?.();ctx.render();return true}
  if(k==='c'&&!e.ctrlKey&&!e.metaKey){ctx.tool='cameraPath';ctx.ui?.();ctx.render();return true}
  if(k==='p'&&!e.ctrlKey&&!e.metaKey){state.pageVisible=!state.pageVisible;ctx.ui?.();ctx.render();return true}
  if(k==='g'||k==='r'||k==='s')return beginTransform(ctx,k,null,e);
  if(k==='delete'||k==='backspace'){
    if(state.edit&&state.selected?.s&&state.selectedPoint>=0){
      const s=state.selected.s;if(s.gp3?.length>2){ctx.snap?.();s.gp3.splice(state.selectedPoint,1);s.p.splice(state.selectedPoint,1);state.selectedPoint=cl(state.selectedPoint-1,0,s.gp3.length-1);ctx.render()}else deleteSelected(ctx);
    }else deleteSelected(ctx);
    return true;
  }
  if(e.shiftKey&&k==='d'){duplicateSelected(ctx);return true}
  if(k==='escape'){state.transform=null;state.selected=null;state.selectedPoint=-1;ctx.ui?.();ctx.render();return true}
  return false;
}
export const greasePencilMode={
  id:'grease',label:'Grease Pencil 3D',icon:'✎3D',
  tools:[['draw','✎','Draw Grease Pencil stroke'],['fill','▣','Fill enclosed Grease Pencil region'],['cameraPath','⌁','Draw 3D camera path'],['select','↖','Select object / stroke'],['edit','◆','Edit Grease Pencil points']],
  panels:['3D View','Grease Pencil','Layers','Depth'],
  shortcuts:{'numpad1':'Front','numpad3':'Right','numpad7':'Top','numpad0':'Perspective','tab':'Edit/Object','g':'Move','r':'Rotate','s':'Scale','x/y/z':'Axis constraint','shift+d':'Duplicate','delete':'Delete','f':'Fill bucket','c':'Camera path','p':'Show/hide 2D page'},
  help:'Blender-style 3D Grease Pencil viewport with drawing planes, selection, edit points, transforms, gizmo, depth, onion skin and navigation.',
  enter,exit,pointerDown,pointerMove,pointerUp,wheel,keydown
};
window.GreasePencil3D={draw,pointerDown,pointerMove,pointerUp,wheel,keydown,ensure,state};
