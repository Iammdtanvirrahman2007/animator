export const animateMode={id:'animate',label:'Animate Mode',icon:'◇',
 tools:[['select','↖','Select animated object'],['pivot','⌖','Set animation pivot']],
 panels:['Keyframes','Timing','Playback','Onion Skin'],
 shortcuts:{i:'insert keyframe',p:'pivot','arrowup':'next keyframe','arrowdown':'previous keyframe'},
 help:'Keyframes, interpolation, timing, playback and onion skin.',
 pointerDown(ctx,e){if(e.button)return false;return false},
 pointerMove(){return false},
 pointerUp(){return false}};