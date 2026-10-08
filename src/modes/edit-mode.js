export const editMode={id:'edit',label:'Edit Mode',icon:'◆',
 tools:[['select','↖','Select / edit stroke points'],['pivot','⌖','Set pivot']],
 panels:['Stroke','Control Points','Transform'],
 shortcuts:{v:'select',p:'pivot'},
 help:'Directly edit individual drawing stroke control points.',
 pointerDown(ctx,e){const {S,pt,loc,dr,hitStroke,nearestPoint,R}=ctx,L=S.l[S.i];if(!L||e.button||!L.v)return false;const p=pt(e),q=loc(L,S.f,p[0],p[1]),hit=hitStroke(dr(L,S.f),q[0],q[1]);if(!hit){ctx.selectedObject=null;R();return true}ctx.selectedObject={L,f:S.f,s:hit};const index=nearestPoint(hit,q[0],q[1]);ctx.md=index>=0?{t:'editPoint',L,f:S.f,s:hit,index,last:q}:{t:'selectOnly'};R();return true},
 pointerMove(ctx,e){if(!ctx.md||ctx.md.t!=='editPoint')return false;const {pt,loc,R}=ctx,q=loc(ctx.md.L,ctx.md.f,...pt(e)),dx=q[0]-ctx.md.last[0],dy=q[1]-ctx.md.last[1];if(dx||dy){if(!ctx.md.changed){ctx.snap();ctx.md.changed=true}ctx.md.s.p[ctx.md.index][0]+=dx;ctx.md.s.p[ctx.md.index][1]+=dy}ctx.md.last=q;R();return true},
 pointerUp(ctx){if(!ctx.md||ctx.md.t!=='editPoint'&&ctx.md.t!=='selectOnly')return false;ctx.md=null;ctx.ui();return true}};