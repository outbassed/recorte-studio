/* Recorte Studio 0.4 — câmera 2D com parallax. Sem WebGL nem objetos 3D. */
(function(){'use strict';
 class RecorteWorld{
  constructor(canvas){this.canvas=canvas;this.pan=0;this.userObjects=[];this.theme='sala';this.ctx=canvas.getContext('2d');canvas.width=1280;canvas.height=720;}
  render(){ /* Objetos SVG são renderizados com personagens na mesma pilha de camadas. */ }
  turn(delta){this.pan=Math.max(-4,Math.min(4,this.pan+delta));this.updateCamera();}
  resetCamera(){this.pan=0;this.updateCamera();}
  updateCamera(){const bg=document.querySelector('#backdropCanvas');if(bg)bg.style.transform=`translateX(${this.pan*-1.4}%) scale(1.08)`;}
  paintExport(ctx,source,w,h){const zoom=1.08,shift=this.pan*-0.014*w;ctx.drawImage(source,(1-zoom)*w/2+shift,(1-zoom)*h/2,w*zoom,h*zoom);}
 }
 window.RecorteWorld=RecorteWorld;
})();
