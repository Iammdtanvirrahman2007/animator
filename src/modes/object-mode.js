export const objectMode={id:'object',label:'Object Mode',icon:'●',
 tools:[['select','↖','Select / move object'],['pivot','⌖','Set pivot']],
 panels:['Transform','Object','Layer'],
 shortcuts:{v:'select',p:'pivot',g:'move',r:'rotate',s:'scale'},
 help:'Object-level selection and transforms.',
 pointerDown(ctx,e){const {S,pt,loc,dr,hitStroke,R}=ctx,L=S.l[S.i];if(!L||e.button||!L.v)return false;const p=pt(e),q=loc(L,S.f,p[0],p[1]),hit=hitStroke(dr(L,S.f),q[0],q[1]);if(!hit){ctx.selectedObject=null;R();return true}ctx.selectedObject={L,f:S.f,s:hit};ctx.md={t:'objectMove',L,f:S.f,s:hit,last:q};R();return true},
 pointerMove(ctx,e){if(!ctx.md||ctx.md.t!=='objectMove')return false;const {S,pt,loc,R}=ctx,q=loc(ctx.md.L,ctx.md.f,...pt(e)),dx=q[0]-ctx.md.last[0],dy=q[1]-ctx.md.last[1];if(dx||dy){if(!ctx.md.changed){ctx.snap();ctx.md.changed=true}for(const v of ctx.md.s.p){v[0]+=dx;v[1]+=dy}}ctx.md.last=q;R();return true},
 pointerUp(ctx){if(!ctx.md||ctx.md.t!=='objectMove')return false;ctx.md=null;ctx.ui();return true}};