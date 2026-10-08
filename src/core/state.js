export const W=960,H=540;
export const clone=o=>JSON.parse(JSON.stringify(o));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const keys=o=>Object.keys(o).map(Number).sort((a,b)=>a-b);
export const makeLayer=n=>({n,v:1,bm:'source-over',e:'ease',px:W/2,py:H/2,d:{},k:{}});
export const freshProject=()=>({fps:24,a:1,b:48,f:1,i:0,on:1,bg:'#fbfaf7',l:[makeLayer('Layer 1')]});
export const easing={linear:t=>t,ease:t=>t*t*(3-2*t),in:t=>t*t,out:t=>1-(1-t)*(1-t),hold:()=>0,bounce:t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375}};
export const keyframe=(L,f)=>keys(L.k).filter(k=>k<=f).pop();
export const drawing=(L,f)=>L.d[keyframe(L,f)]||[];
export function transformAt(L,f){const K=keys(L.k);if(!K.length)return{x:0,y:0,r:0,s:1,o:1};const a=K.filter(k=>k<=f).pop(),b=K.find(k=>k>f);if(a==null)return{...L.k[b]};if(b==null||a===f)return{...L.k[a]};const t=easing[L.e]((f-a)/(b-a)),A=L.k[a],B=L.k[b],r={};for(const p in A)r[p]=A[p]+(B[p]-A[p])*t;return r}