const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2])||1;
const norm=a=>vmul(a,1/len(a));

const state={
 yaw:0.35,pitch:-0.22,distance:900,target:[0,0,0],
 focal:720,grid:80,drawPlane:'XY',drag:null,transform:null,selected:null,selectedPoint:-1,edit:false
};

function ensure(S){
  if(!S.gp3d)S.gp3d={yaw:state.yaw,pitch:state.pitch,distance:state.distance,target:[0,0,0],focal:720,grid:80,active:true};
  state.yaw=S.gp3d.yaw;state.pitch=S.gp3d.pitch;state.distance=S.gp3d.distance;
  state.target=S.gp3d.target||[0,0,0];state.focal=S.gp3d.focal||720;state.grid=S.gp3d.grid||80;
}
function persist(S){
  if(!S.gp3d)S.gp3d={};
  S.gp3d.yaw=state.yaw;S.gp3d.pitch=state.pitch;S.gp3d.distance=state.distance;
  S.gp3d.target=[...state.target];S.gp3d.focal=state.focal;S.gp3d.grid=state.grid;S.gp3d.active=true;
}
function camera(){
  const cp=Math.cos(state.pitch),sp=Math.sin(state.pitch),cy=Math.cos(state.yaw),sy=Math.sin(state.yaw);
  const pos=[
    state.target[0]+state.distance*cp*sy,
    state.target[1]+state.distance*sp,
    state.target[2]+state.distance*cp*cy
  ];
  const forward=norm(vsub(state.target,pos));
  const worldUp=[0,1,0];
  let right=norm(cross(forward,worldUp));
  if(len(right)<1.01)right=[1,0,0];
  const up=norm(cross(right,forward));
  return {pos,forward,right,up};
}
function project(p){
  const cam=camera(),q=vsub(p,cam.pos),z=dot(q,cam.forward);
  if(z<=8)return null;
  const k=state.focal/z;
  return [480+dot(q,cam.right)*k,270-dot(q,cam.up)*k,z];
}
function planePoint(x,y,plane){
  const cam=camera(),nx=(x-480)/state.focal,ny=-(y-270)/state.focal;
  const dir=norm(vadd(cam.forward,vadd(vmul(cam.right,nx),vmul(cam.up,ny))));
  const axis=plane==='XZ'?1:plane==='YZ'?0:2;
  const value=0;
  const t=(value-cam.pos[axis])/(dir[axis]||1e-6);
  return vadd(cam.pos,vmul(dir,t));
}
function unprojectPlane(x,y,z=0){
  const cam=camera(),nx=(x-480)/state.focal,ny=-(y-270)/state.focal;
  const dir=norm(vadd(cam.forward,vadd(vmul(cam.right,nx),vmul(cam.up,ny))));
  const t=(z-cam.pos[2])/(dir[2]||1e-6);
  const p=vadd(cam.pos,vmul(dir,t));
  return [p[0],p[1],z];
}
function worldFromStroke(s){
  if(Array.isArray(s.gp3)&&s.gp3.length)return s.gp3[0];
  const z=Number.isFinite(+s.z)?+s.z:0;
  return [s.p?.[0]?.[0]-480,270-(s.p?.[0]?.[1]??270),z];
}
function worldPoints(s){
  if(Array.isArray(s.gp3)&&s.gp3.length)return s.gp3;
  const w=worldFromStroke(s);return (s.p||[]).map(()=>w);
}
function drawGrid(c){
  c.save();
  c.lineWidth=1;
  for(let z=-800;z<=800;z+=state.grid){
    let a=project([-800,0,z]),b=project([800,0,z]);
    if(a&&b){c.strokeStyle='#ffffff12';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke()}
  }
  for(let x=-800;x<=800;x+=state.grid){
    let a=project([x,0,-800]),b=project([x,0,800]);
    if(a&&b){c.strokeStyle='#ffffff12';c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke()}
  }
  const axes=[
    [[-900,0,0],[900,0,0],'#d85c5c'],
    [[0,-900,0],[0,900,0],'#70c080'],
    [[0,0,-900],[0,0,900],'#5d8fd3']
  ];
  for(const [a,b,col] of axes){
    const p=project(a),q=project(b);if(!p||!q)continue;
    c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(q[0],q[1]);c.stroke();
  }
  c.restore();
}
function strokeCenter(s){
  const pts=worldPoints(s);
  if(!pts.length)return [0,0,0];
  return pts.reduce((a,p)=>vadd(a,p),[0,0,0]).map(v=>v/pts.length);
}
function hitStroke(s,x,y){
  const pts=worldPoints(s).map(project).filter(Boolean);
  let best=null,d=Infinity;
  for(let i=0;i<pts.length;i++){
    const q=Math.hypot(pts[i][0]-x,pts[i][1]-y);
    if(q<d){d=q;best=i}
  }
  return d<14?{index:best,d}:null;
}
function selectedStroke(S){
  return state.selected?.s||null;
}
function drawSelection(c,S){
  const s=selectedStroke(S);if(!s)return;
  const pts=worldPoints(s).map(project).filter(Boolean);if(!pts.length)return;
  c.save();c.strokeStyle='#ffd54a';c.lineWidth=2;c.setLineDash([6,4]);
  const box=pts.reduce((a,p)=>({minX:Math.min(a.minX,p[0]),minY:Math.min(a.minY,p[1]),maxX:Math.max(a.maxX,p[0]),maxY:Math.max(a.maxY,p[1])}),{minX:pts[0][0],minY:pts[0][1],maxX:pts[0][0],maxY:pts[0][1]});
  c.strokeRect(box.minX-6,box.minY-6,box.maxX-box.minX+12,box.maxY-box.minY+12);
  c.setLineDash([]);
  c.fillStyle='#ffd54a';
  pts.forEach((p,i)=>{c.beginPath();c.arc(p[0],p[1],i===state.selectedPoint?5:3,0,Math.PI*2);c.fill()});
  c.restore();
}
function transformStroke(s,type,dx,dy){
  if(!s?.gp3?.length)return;
  const center=strokeCenter(s);
  const cam=camera();
  if(type==='g'){
    const amountX=dx/state.distance*1.5,amountY=dy/state.distance*1.5;
    const delta=vadd(vmul(cam.right,-amountX),vmul(cam.up,amountY));
    s.gp3=s.gp3.map(p=>vadd(p,delta));
  }else if(type==='s'){
    const factor=Math.max(.05,Math.exp(dy*.006));
    s.gp3=s.gp3.map(p=>vadd(center,vmul(vsub(p,center),factor)));
  }else if(type==='r'){
    const a=-dx*.008,ca=Math.cos(a),sa=Math.sin(a);
    s.gp3=s.gp3.map(p=>{
      const q=vsub(p,center);
      const x=q[0]*ca-q[2]*sa,z=q[0]*sa+q[2]*ca;
      return vadd(center,[x,q[1],z]);
    });
  }
}
function drawStroke(c,s,i){
  if(!s.p?.length)return;
  const pts=worldPoints(s).map(project).filter(Boolean);
  if(!pts.length)return;
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(let j=1;j<pts.length;j++)c.lineTo(pts[j][0],pts[j][1]);
  const z=pts.reduce((a,p)=>a+p[2],0)/pts.length;
  c.lineWidth=Math.max(.5,(s.w||1)*Math.max(.25,720/z));
  c.lineCap=c.lineJoin='round';c.strokeStyle=s.c||'#111';c.globalAlpha=.98;c.stroke();
}
function draw(ctx,S,f,on){
  ensure(S);
  const c=ctx;
  c.save();
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
  c.fillStyle='#202124';c.fillRect(0,0,960,540);
  drawGrid(c);
  const ordered=[];
  S.l.forEach((L,i)=>{if(!L.v)return;const d=L.d?.[f]||[];for(const s of d)ordered.push({s,i,z:Number.isFinite(+s.z)?+s.z:i*45})});
  ordered.sort((a,b)=>b.z-a.z);
  if(on&&S.f>1){
    const prev=S.l.flatMap(L=>(L.d?.[S.f-1]||[]).map(s=>({s,i:S.l.indexOf(L)})));
    const next=S.l.flatMap(L=>(L.d?.[S.f+1]||[]).map(s=>({s,i:S.l.indexOf(L)})));
    c.save();c.globalAlpha=.18;c.strokeStyle='#6aa9ff';for(const item of prev)drawStroke(c,item.s,item.i);c.restore();
    c.save();c.globalAlpha=.18;c.strokeStyle='#ff78a8';for(const item of next)drawStroke(c,item.s,item.i);c.restore();
  }
  for(const item of ordered)drawStroke(c,item.s,item.i);
  drawSelection(c,S);
  c.restore();
  c.save();
  c.fillStyle='#d9d9d9';c.font='11px system-ui';c.fillText('3D Grease Pencil',14,20);
  c.fillStyle='#9fa4aa';c.fillText('LMB Draw  •  MMB Orbit  •  Shift+MMB Pan  •  Wheel Dolly  •  Numpad 1/3/7 Views',14,38);
  c.fillText('['+' / '+']'+' layer depth  •  Plane: '+state.drawPlane+'  •  G/R/S transform',14,54);
  c.restore();
}
function screen(e){
  const r=e.currentTarget.getBoundingClientRect();
  return [(e.clientX-r.left)*960/r.width,(e.clientY-r.top)*540/r.height];
}
function enter(ctx){
  ensure(ctx.S);
  ctx.S.gp3d.active=true;persist(ctx.S);
}
function exit(ctx){
  if(ctx.S?.gp3d)persist(ctx.S);
}
function pointerDown(ctx,e){
  if(e.button===1){
    ctx.md={t:e.shiftKey?'gpPan':'gpOrbit',x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,target:[...state.target]};
    return true;
  }
  if(e.button!==0)return false;
  const S=ctx.S,L=S.l[S.i];if(!L||!L.v)return true;
  const [sx,sy]=screen(e);
  if(ctx.tool==='select'){
    let best=null;
    for(let li=0;li<S.l.length;li++){
      const layer=S.l[li];if(!layer.v)continue;
      for(const s of layer.d?.[S.f]||[]){const h=hitStroke(s,sx,sy);if(h&&(!best||h.d<best.h.d))best={s,li,h}}
    }
    state.selected=best;state.selectedPoint=best?.h.index??-1;
    ctx.ui?.();ctx.render();return true;
  }
  const z=Number.isFinite(+L.gpZ)?+L.gpZ:S.i*45;
  const w=planePoint(sx,sy,state.drawPlane);
  const a=[w[0]+480,270-w[1]];
  if(!(S.f in L.d))L.d[S.f]=[];
  const s={c:ctx.col?.value||'#1b1b1b',w:+(ctx.sz?.value||4),f:!!ctx.fl?.checked,p:[[a[0],a[1]]],z,plane:state.drawPlane,gp3:[w]};
  ctx.snap?.();
  L.d[S.f].push(s);
  ctx.md={t:'gpDraw',L,s,z};
  ctx.render();return true;
}
function pointerMove(ctx,e){
  if(state.transform){
    const t=state.transform,dx=e.clientX-t.x,dy=e.clientY-t.y;
    if(state.selected?.s){
      transformStroke(state.selected.s,t.type,dx,dy);persist(ctx.S);ctx.render();return true;
    }
    if(t.type==='g'){const cam=camera();state.target=vadd(t.target,vadd(vmul(cam.right,-dx/state.distance*1.5),vmul(cam.up,dy/state.distance*1.5)));}
    if(t.type==='r'){state.yaw=t.yaw-dx*.008;state.pitch=clamp(t.pitch+dy*.006,-1.45,1.45);}
    if(t.type==='s'){state.distance=clamp(t.distance*Math.exp(dy*.006),120,5000);}
    persist(ctx.S);ctx.render();return true;
  }
  if(ctx.md.t==='gpOrbit'){
    state.yaw=ctx.md.yaw-(e.clientX-ctx.md.x)*.008;
    state.pitch=clamp(ctx.md.pitch+(e.clientY-ctx.md.y)*.006,-1.45,1.45);
    persist(ctx.S);ctx.render();return true;
  }
  if(ctx.md.t==='gpPan'){
    const dx=(e.clientX-ctx.md.x)/Math.max(.1,ctx.S.gp3d?.distance/720||1);
    const dy=(e.clientY-ctx.md.y)/Math.max(.1,ctx.S.gp3d?.distance/720||1);
    const cam=camera();
    state.target=vadd(ctx.md.target,vadd(vmul(cam.right,-dx),vmul(cam.up,dy)));
    persist(ctx.S);ctx.render();return true;
  }
  if(ctx.md.t==='gpDraw'){
    const [sx,sy]=screen(e),w=planePoint(sx,sy,ctx.md.s.plane||state.drawPlane),a=[w[0]+480,270-w[1]];
    const p=ctx.md.s.p,last=p[p.length-1],gp=ctx.md.s.gp3;
    if(Math.hypot(a[0]-last[0],a[1]-last[1])>1.2){p.push(a);gp.push(w);}
    persist(ctx.S);ctx.render();return true;
  }
  return false;
}
function pointerUp(ctx){
  if(state.transform){state.transform=null;ctx.ui?.();persist(ctx.S);return true;}
  if(!ctx.md)return false;
  if(ctx.md.t==='gpDraw')ctx.ui?.();
  ctx.md=null;return true;
}
function wheel(ctx,e){
  state.distance=cl(state.distance*(e.deltaY>0?1.1:.9),120,5000);
  persist(ctx.S);ctx.render();return true;
}
function keydown(ctx,e){
  const k=e.key.toLowerCase();
  if(k==='1'&&e.code==='Numpad1'){state.yaw=0;state.pitch=0;persist(ctx.S);ctx.render();return true}
  if(k==='3'&&e.code==='Numpad3'){state.yaw=Math.PI/2;state.pitch=0;persist(ctx.S);ctx.render();return true}
  if(k==='7'&&e.code==='Numpad7'){state.yaw=0;state.pitch=Math.PI/2-.001;persist(ctx.S);ctx.render();return true}
  if(k==='0'&&e.code==='Numpad0'){state.yaw=.35;state.pitch=-.22;persist(ctx.S);ctx.render();return true}
  if(k==='x'||k==='y'||k==='z'){
    state.drawPlane=k==='x'?'YZ':k==='y'?'XZ':'XY';ctx.ui?.();ctx.render();return true;
  }
  if(k==='['||k===']'){
    const L=ctx.S.l[ctx.S.i];if(!L)return true;
    L.gpZ=(Number.isFinite(+L.gpZ)?+L.gpZ:ctx.S.i*45)+(k===']'?20:-20);
    ctx.ui?.();persist(ctx.S);ctx.render();return true;
  }
  if(k==='g'||k==='r'||k==='s'){
    if(state.selected?.s){
      state.transform={type:k,x:e.clientX,y:e.clientY};
      return true;
    }
    state.transform={type:k,x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,distance:state.distance,target:[...state.target]};
    return true;
  }
  if(k==='tab'){state.edit=!state.edit;ctx.ui?.();ctx.render();return true}
  if(k==='escape'){state.transform=null;state.selected=null;state.selectedPoint=-1;ctx.ui?.();ctx.render();return true}
  return false;
}
export const greasePencilMode={
  id:'grease',
  label:'Grease Pencil 3D',
  icon:'✎3D',
  tools:[['draw','✎','Draw Grease Pencil stroke'],['select','↖','Select Grease Pencil object / stroke'],['edit','◆','Edit Grease Pencil points']],
  panels:['3D View','Grease Pencil','Layers','Depth'],
  shortcuts:{'numpad1':'Front','numpad3':'Right','numpad7':'Top','tab':'Edit/Object mode','g':'Move selected stroke','r':'Rotate selected stroke','s':'Scale selected stroke','[':'Move layer back',']':'Move layer forward'},
  help:'Blender-style 3D Grease Pencil viewport with object selection, point editing, transforms, planes and onion skin.',
  enter,
  exit,
  pointerDown,
  pointerMove,
  pointerUp,
  wheel,
  keydown
};
window.GreasePencil3D={draw,pointerDown,pointerMove,pointerUp,wheel,keydown,ensure,state};
