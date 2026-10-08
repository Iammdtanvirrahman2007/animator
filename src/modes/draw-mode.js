export const drawMode={
 id:'draw',
 label:'Draw Mode',
 icon:'✎',
 tools:[['draw','✎','Draw brush (D)'],['erase','⌫','Erase strokes (E)'],['line','╱','Line (L)'],['box','▭','Rectangle (B)'],['oval','◯','Ellipse (O)']],
 help:'Draw, erase and create vector-like stroke shapes.',
 pointerDown(ctx,e){
  const {S,pt,loc,dr,shape,clone,R,snap,ad,col,sz,fl,ev}=ctx,L=S.l[S.i];
  if(!L||e.button||!L.v)return false;
  const p=pt(e),f=S.f,shapeTool=['line','box','oval'].includes(ctx.tool),before=shapeTool?JSON.stringify(S):null;
  if(!shapeTool)snap();
  if(ctx.tool==='erase'){ctx.md={t:'erase',L};ctx.er(e);return true}
  if(!(f in L.d))L.d[f]=ad.checked?clone(dr(L,f)):[];
  const a=loc(L,f,p[0],p[1]),s={c:col.value,w:+sz.value/ev(L,f).s,f:fl.checked,p:[a]};
  L.d[f].push(s);ctx.md={t:ctx.tool,s,L,f,a,before};R();return true;
 },
 pointerMove(ctx,e){
  if(!ctx.md)return false;
  const {md,pt,loc,R,shape}=ctx;
  if(md.t==='erase'){ctx.er(e);return true}
  if(!['draw','line','box','oval'].includes(md.t))return false;
  const b=loc(md.L,md.f,...pt(e));
  if(md.t==='draw'){
   const q=md.s.p[md.s.p.length-1];
   if(Math.hypot(b[0]-q[0],b[1]-q[1])>1.5)md.s.p.push(b);
  }else md.s.p=shape(md.t,md.a,b);
  R();return true;
 },
 pointerUp(ctx){
  const {md,ui,sm,vp,R}=ctx;
  if(!md||!['draw','line','box','oval'].includes(md.t))return false;
  if(md.t==='draw'){
   const p=md.s.p;
   for(let k=0;k<+sm.value;k++)for(let i=1;i<p.length-1;i++)p[i]=[(p[i-1][0]+p[i][0]*2+p[i+1][0])/4,(p[i-1][1]+p[i][1]*2+p[i+1][1])/4];
  }
  if(['line','box','oval'].includes(md.t)){
   ctx.pendingShape={before:md.before,L:md.L,s:md.s,f:md.f};ctx.md=null;
   vp.classList.remove('cursor-grabbing');vp.classList.add('cursor-grab');R();
   ctx.msg('Drag to reposition · Enter to confirm · Esc to cancel');return true;
  }
  ctx.md=null;ui();return true;
 }
};