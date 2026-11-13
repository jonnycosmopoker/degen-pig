/* Animated premium tables. DPTable(canvas, kind, assets) returns { draw(t) } where t is seconds; everything loops every 8 seconds. */
window.DPTable=function(cv,kind,A){
  var ctx=cv.getContext('2d'),LOOP=8,TAU=Math.PI*2,cw=0,ch=0,dpr=1,sc=1,ox=0,oy=0;
  function fit(){dpr=Math.min(window.devicePixelRatio||1,2);cw=cv.clientWidth;ch=cv.clientHeight;cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);
    sc=Math.max(cw/1600,ch/1000);ox=(cw-1600*sc)/2;oy=(ch-1000*sc)/2}
  function cover(img,extra,dx,dy){var s=sc*(extra||1),w=1600*s,h=1000*s;ctx.drawImage(img,(cw-w)/2+(dx||0),(ch-h)/2+(dy||0),w,h)}
  function rnd(i,k){var x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x)}
  function vignette(a){var g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*.35,cw/2,ch/2,Math.hypot(cw,ch)*.6);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,'+a+')');ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch)}

  /* ---------- Molten Core: lava flowing under shattered planks ---------- */
  var pat=null;
  function lava(t){
    if(!pat)pat=ctx.createPattern(A.lava,'repeat');
    var u=(t%LOOP)/LOOP,ts=512*sc*1.05;
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    pat.setTransform(new DOMMatrix().translate(u*ts,ts*.3).scale(sc*1.05));ctx.fillStyle=pat;ctx.fillRect(0,0,cw,ch);
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=.55;var ts2=512*sc*1.7;
    pat.setTransform(new DOMMatrix().translate(ts2*.4,u*ts2).scale(sc*1.7));ctx.fillRect(0,0,cw,ch);
    /* a hot surge that wanders under the wood */
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1;
    var sx=cw/2+Math.cos(u*TAU)*cw*.26,sy=ch/2+Math.sin(u*TAU*2)*ch*.2,g=ctx.createRadialGradient(sx,sy,0,sx,sy,cw*.34);
    g.addColorStop(0,'rgba(255,190,70,.5)');g.addColorStop(1,'rgba(255,90,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
    /* the planks on top, then the light spilling out of the cracks */
    ctx.globalCompositeOperation='source-over';cover(A.wood);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.5+.16*Math.sin(u*TAU*2)+.07*Math.sin(u*TAU*5+1);cover(A.glow);
    /* embers rising off the cracks */
    ctx.globalAlpha=1;
    for(var i=0;i<54;i++){
      var per=[2,8/3,4][i%3],ph=rnd(i,1)*per,tt=t+ph,c=Math.floor(tt/per)%Math.round(LOOP/per),e=(tt/per)%1;
      var p=A.points[Math.floor(rnd(i,c+7)*A.points.length)],x=ox+p[0]*1600*sc,y=oy+p[1]*1000*sc;
      x+=Math.sin(e*5+i)*9*e+(rnd(i,3)-.5)*26*e;y-=e*(46+rnd(i,4)*90);
      var a=Math.pow(Math.sin(Math.PI*e),.7),r=.7+rnd(i,5)*1.5;
      var eg=ctx.createRadialGradient(x,y,0,x,y,r*4.5);eg.addColorStop(0,'rgba(255,140,30,'+(a*.55)+')');eg.addColorStop(1,'rgba(255,80,0,0)');ctx.fillStyle=eg;ctx.beginPath();ctx.arc(x,y,r*4.5,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(255,225,140,'+a+')';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';vignette(.5);
  }

  /* ---------- Deep Space: drifting nebula, twinkling stars, shooting stars ---------- */
  var COL=['255,255,255','200,222,255','255,236,205','185,205,255'];
  function space(t){
    var u=(t%LOOP)/LOOP;
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#04050e';ctx.fillRect(0,0,cw,ch);
    cover(A.space,1.06,Math.sin(u*TAU)*5,Math.cos(u*TAU)*4);
    ctx.globalCompositeOperation='lighter';
    A.stars.forEach(function(s){
      var x=s[0]*cw,y=s[1]*ch,r=s[2],a=.3+.7*(.5+.5*Math.sin(u*TAU*s[4]+s[5]));
      ctx.fillStyle='rgba('+COL[s[3]]+','+a+')';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
      if(r>1.55){var L=r*(2.2+3.2*a);ctx.strokeStyle='rgba('+COL[s[3]]+','+(a*.45)+')';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-L,y);ctx.lineTo(x+L,y);ctx.moveTo(x,y-L);ctx.lineTo(x,y+L);ctx.stroke();
        var g=ctx.createRadialGradient(x,y,0,x,y,r*5);g.addColorStop(0,'rgba('+COL[s[3]]+','+(a*.35)+')');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*5,0,TAU);ctx.fill()}
    });
    /* shooting stars: 7 every loop, one of them a big one that breaks into sparks */
    var N=7,tm=t%LOOP;
    for(var k=0;k<N;k++){
      var big=k===2,t0=k*LOOP/N+rnd(k,1)*.5,dur=big?1.5:.75+rnd(k,2)*.45,e=(tm-t0)/dur;if(e<0)e=(tm+LOOP-t0)/dur;if(e<0||e>1)continue;
      var left=rnd(k,3)<.72,ang=(left?Math.PI-(.42+rnd(k,4)*.3):.42+rnd(k,4)*.3),dx=Math.cos(ang),dy=Math.sin(ang);
      var x0=(left?.45+rnd(k,5)*.65:rnd(k,5)*.5)*cw,y0=(-.04+rnd(k,6)*.42)*ch,dist=(big?.95:.6+rnd(k,7)*.3)*cw;
      var ez=1-Math.pow(1-e,1.6),hx=x0+dx*dist*ez,hy=y0+dy*dist*ez,env=Math.sin(Math.PI*Math.min(1,e*1.15)),len=(big?240:130+rnd(k,8)*70)*env,w=big?3.8:2.6;
      var tx=hx-dx*len,ty=hy-dy*len,g=ctx.createLinearGradient(hx,hy,tx,ty);
      g.addColorStop(0,'rgba(255,255,255,'+env+')');g.addColorStop(.25,'rgba(170,215,255,'+(env*.7)+')');g.addColorStop(1,'rgba(90,130,255,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(hx-dy*w/2,hy+dx*w/2);ctx.lineTo(tx,ty);ctx.lineTo(hx+dy*w/2,hy-dx*w/2);ctx.closePath();ctx.fill();
      var hg=ctx.createRadialGradient(hx,hy,0,hx,hy,big?20:12);hg.addColorStop(0,'rgba(255,255,255,'+env+')');hg.addColorStop(.35,'rgba(180,220,255,'+(env*.6)+')');hg.addColorStop(1,'rgba(120,160,255,0)');
      ctx.fillStyle=hg;ctx.beginPath();ctx.arc(hx,hy,big?20:12,0,TAU);ctx.fill();
      if(big)for(var j=0;j<14;j++){var back=rnd(j,11)*len*.9,off=(rnd(j,12)-.5)*16*(back/len),fa=env*(1-back/len)*(.5+.5*Math.sin(t*14+j*2.1));
        ctx.fillStyle='rgba(215,235,255,'+Math.max(0,fa)+')';ctx.beginPath();ctx.arc(hx-dx*back-dy*off,hy-dy*back+dx*off,.9+rnd(j,13),0,TAU);ctx.fill()}
    }
    ctx.globalCompositeOperation='source-over';vignette(.42);
  }
  fit();window.addEventListener('resize',fit);
  return {draw:function(t){if(cv.clientWidth!==cw||cv.clientHeight!==ch)fit();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);(kind==='lava'?lava:space)(t)}};
};
