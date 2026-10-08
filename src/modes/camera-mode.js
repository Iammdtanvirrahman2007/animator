export const cameraMode={id:'camera',label:'Camera Mode',icon:'▣',
 tools:[['select','▣','Camera frame'],['pivot','⌖','Camera pivot']],
 panels:['Camera','Composition','Camera Animation'],
 shortcuts:{g:'move camera',r:'rotate camera',s:'zoom camera'},
 help:'Camera framing, composition guides and camera animation.',
 pointerDown(){return false},pointerMove(){return false},pointerUp(){return false}};