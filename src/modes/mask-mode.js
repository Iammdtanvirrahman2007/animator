export const maskMode={id:'mask',label:'Mask Mode',icon:'▤',
 tools:[['draw','✎','Mask brush'],['erase','⌫','Mask eraser'],['box','▭','Rectangle mask'],['oval','◯','Ellipse mask']],
 panels:['Mask','Feather','Mask Animation'],
 shortcuts:{d:'mask brush',e:'mask eraser',b:'rectangle mask',o:'ellipse mask'},
 help:'Non-destructive mask creation, editing and animation.',
 pointerDown(){return false},pointerMove(){return false},pointerUp(){return false}};