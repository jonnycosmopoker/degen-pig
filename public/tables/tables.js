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

  /* ---------- Christmas Eve: evergreen felt, snow drifts in the corners, falling snow, a string of twinkling lights round the rim ---------- */
  var FL=null,LP=null,LPk='';
  var BULB=['255,46,56','255,196,48','46,214,96','70,150,255','255,244,214'];
  function rimPoints(){
    var k=cw+'x'+ch;if(LPk===k)return LP;LPk=k;LP=[];
    var I=13,R=13,x0=I,y0=I,x1=cw-I,y1=ch-I,segs=[],step=24;
    /* walk the rounded rectangle, dropping a bulb every ~24px */
    var path=[];function line(ax,ay,bx,by,nx,ny){path.push({t:'l',ax:ax,ay:ay,bx:bx,by:by,nx:nx,ny:ny,len:Math.hypot(bx-ax,by-ay)})}
    function arc(cx,cy,a0,a1){path.push({t:'a',cx:cx,cy:cy,a0:a0,a1:a1,len:Math.abs(a1-a0)*R})}
    line(x0+R,y0,x1-R,y0,0,1);arc(x1-R,y0+R,-Math.PI/2,0);line(x1,y0+R,x1,y1-R,-1,0);arc(x1-R,y1-R,0,Math.PI/2);
    line(x1-R,y1,x0+R,y1,0,-1);arc(x0+R,y1-R,Math.PI/2,Math.PI);line(x0,y1-R,x0,y0+R,1,0);arc(x0+R,y0+R,Math.PI,Math.PI*1.5);
    var tot=0;path.forEach(function(p){tot+=p.len});var n=Math.max(12,Math.round(tot/step)),gap=tot/n;
    for(var i=0;i<n;i++){var d=i*gap,j=0;while(d>path[j].len){d-=path[j].len;j++}var p=path[j],x,y,nx,ny;
      if(p.t==='l'){var f=d/p.len;x=p.ax+(p.bx-p.ax)*f;y=p.ay+(p.by-p.ay)*f;nx=p.nx;ny=p.ny}
      else{var a=p.a0+(p.a1-p.a0)*(d/p.len);x=p.cx+Math.cos(a)*R;y=p.cy+Math.sin(a)*R;nx=-Math.cos(a);ny=-Math.sin(a)}
      LP.push({x:x,y:y,nx:nx,ny:ny})}
    return LP;
  }
  function flakeStar(x,y,s,rot,a){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.strokeStyle='rgba(255,255,255,'+a+')';ctx.lineWidth=Math.max(.8,s*.16);ctx.lineCap='round';ctx.beginPath();
    for(var k=0;k<6;k++){var c=Math.cos(k*Math.PI/3),sn=Math.sin(k*Math.PI/3);ctx.moveTo(0,0);ctx.lineTo(c*s,sn*s);
      var bx=c*s*.55,by=sn*s*.55;for(var q=-1;q<2;q+=2){var b=k*Math.PI/3+q*.8;ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(b)*s*.35,by+Math.sin(b)*s*.35)}}
    ctx.stroke();ctx.restore()}
  function xmas(t){
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;cover(A.bg);vignette(.38);
    /* snow drifts piled in the corners */
    var dw=Math.min(cw*.44,ch*.6),dh=dw*400/520;
    ctx.drawImage(A.drift,0,0,dw,dh);
    ctx.save();ctx.translate(cw,0);ctx.scale(-1,1);ctx.drawImage(A.drift,0,0,dw*.8,dh*.8);ctx.restore();
    ctx.save();ctx.translate(0,ch);ctx.scale(1,-1);ctx.drawImage(A.drift,0,0,dw*.86,dh*.7);ctx.restore();
    ctx.save();ctx.translate(cw,ch);ctx.scale(-1,-1);ctx.drawImage(A.drift,0,0,dw*1.05,dh*.85);ctx.restore();
    /* falling snow in three depths: soft far flakes, round mid flakes, a few big crystal flakes up close */
    if(!FL){FL=[];for(var i=0;i<120;i++){var z=rnd(i,1);FL.push({x:rnd(i,2),y:rnd(i,3),z:z,r:.7+z*z*2.4,sp:14+z*46,sw:5+rnd(i,4)*16,f:.35+rnd(i,5)*.8,ph:rnd(i,6)*TAU,big:z>.95,rs:(rnd(i,7)-.5)*1.4})}}
    FL.forEach(function(f){var H=ch+30,y=((f.y*H+t*f.sp)%H)-15,x=f.x*cw+Math.sin(t*f.f+f.ph)*f.sw,a=.35+.6*f.z;
      if(f.big){flakeStar(x,y,f.r*2.2,t*f.rs+f.ph,a);return}
      if(f.r>1.6){var g=ctx.createRadialGradient(x,y,0,x,y,f.r*2.2);g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(.45,'rgba(240,248,255,'+(a*.7)+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,f.r*2.2,0,TAU);ctx.fill()}
      else{ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.beginPath();ctx.arc(x,y,f.r,0,TAU);ctx.fill()}});
    /* the light string: a dark green wire sagging between bulbs, then each bulb with its glow */
    var P=rimPoints(),n=P.length;
    ctx.strokeStyle='#0B2614';ctx.lineWidth=1.8;ctx.beginPath();
    for(var i=0;i<=n;i++){var p=P[i%n],q=P[(i+1)%n];if(i===0)ctx.moveTo(p.x,p.y);if(i<n){var mx=(p.x+q.x)/2+(p.nx+q.nx)*2.6,my=(p.y+q.y)/2+(p.ny+q.ny)*2.6;ctx.quadraticCurveTo(mx,my,q.x,q.y)}}
    ctx.stroke();
    ctx.globalCompositeOperation='lighter';
    var B=[];
    for(var i=0;i<n;i++){var c=BULB[i%5],chase=.5+.5*Math.sin(t*2.4-i*.62),tw=.5+.5*Math.sin(t*(5+rnd(i,9)*4)+i),b=.32+.5*chase*chase+.18*tw;B.push(b);
      var p=P[i],gx=p.x+p.nx*5,gy=p.y+p.ny*5,R=12+16*b,g=ctx.createRadialGradient(gx,gy,0,gx,gy,R);
      g.addColorStop(0,'rgba('+c+','+(.75*b)+')');g.addColorStop(.4,'rgba('+c+','+(.3*b)+')');g.addColorStop(1,'rgba('+c+',0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(gx,gy,R,0,TAU);ctx.fill()}
    ctx.globalCompositeOperation='source-over';
    for(var i=0;i<n;i++){var c=BULB[i%5],p=P[i],b=B[i],ang=Math.atan2(p.ny,p.nx);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);
      ctx.fillStyle='#16361F';ctx.fillRect(-1.2,-2.4,3.2,4.8);           /* socket */
      var bg=ctx.createRadialGradient(5.2,-.8,0,5,0,4.6);bg.addColorStop(0,'rgba(255,255,255,'+(.55+.45*b)+')');bg.addColorStop(.35,'rgba('+c+','+(.75+.25*b)+')');bg.addColorStop(1,'rgba('+c+','+(.45+.3*b)+')');
      ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(5.4,0,4.4,3.1,0,0,TAU);ctx.fill();ctx.restore()}
  }

  /* ---------- Gold Vault: quilted black leather, a gold chain round the rim, glints and a slow light sweep ---------- */
  var GP=null,GPk='';
  function chainPoints(){
    var k=cw+'x'+ch;if(GPk===k)return GP;GPk=k;GP=[];
    var I=15,R=14,x0=I,y0=I,x1=cw-I,y1=ch-I,path=[];
    function line(ax,ay,bx,by){path.push({t:'l',ax:ax,ay:ay,bx:bx,by:by,len:Math.hypot(bx-ax,by-ay)})}
    function arc(cx,cy,a0,a1){path.push({t:'a',cx:cx,cy:cy,a0:a0,a1:a1,len:Math.abs(a1-a0)*R})}
    line(x0+R,y0,x1-R,y0);arc(x1-R,y0+R,-Math.PI/2,0);line(x1,y0+R,x1,y1-R);arc(x1-R,y1-R,0,Math.PI/2);
    line(x1-R,y1,x0+R,y1);arc(x0+R,y1-R,Math.PI/2,Math.PI);line(x0,y1-R,x0,y0+R);arc(x0+R,y0+R,Math.PI,Math.PI*1.5);
    var tot=0;path.forEach(function(p){tot+=p.len});var n=Math.round(tot/15);if(n%2)n++;var gap=tot/n;
    for(var i=0;i<n;i++){var d=i*gap,j=0;while(d>path[j].len){d-=path[j].len;j++}var p=path[j],x,y,a;
      if(p.t==='l'){var f=d/p.len;x=p.ax+(p.bx-p.ax)*f;y=p.ay+(p.by-p.ay)*f;a=Math.atan2(p.by-p.ay,p.bx-p.ax)}
      else{var an=p.a0+(p.a1-p.a0)*(d/p.len);x=p.cx+Math.cos(an)*R;y=p.cy+Math.sin(an)*R;a=an+Math.PI/2}
      GP.push({x:x,y:y,a:a})}
    return GP;
  }
  function glint(x,y,s,a){if(a<=0)return;ctx.save();ctx.translate(x,y);ctx.globalAlpha=a;
    var g=ctx.createRadialGradient(0,0,0,0,0,s*.9);g.addColorStop(0,'rgba(255,255,240,.9)');g.addColorStop(1,'rgba(255,220,120,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,s*.9,0,TAU);ctx.fill();
    ctx.fillStyle='#FFFFF4';ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(0,0,s,0);ctx.quadraticCurveTo(0,0,0,s);ctx.quadraticCurveTo(0,0,-s,0);ctx.quadraticCurveTo(0,0,0,-s);ctx.fill();ctx.restore()}
  function goldv(t){
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;cover(A.bg);
        var spots=[];
    /* the chain: links alternate face-on and edge-on, each turned along the rim */
    var P=chainPoints(),L=23;
    for(var i=0;i<P.length;i++){var p=P[i],im=i%2?A.lb:A.la,h=i%2?L*.3:L*56/96;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
      if(!(i%2)){ctx.globalAlpha=.55;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(1,2,L/2,h/2,0,0,TAU);ctx.fill();ctx.globalAlpha=1}
      ctx.drawImage(im,-L/2,-h/2,L,h);ctx.restore();if(i%4===1)spots.push([p.x,p.y])}
    /* a slow band of light sweeps across every five seconds */
    var u=(t%5)/5,sx=-cw*.6+u*cw*2.2;
    ctx.globalCompositeOperation='overlay';
    var g=ctx.createLinearGradient(sx-90,0,sx+90,ch*.3);g.addColorStop(0,'rgba(255,240,200,0)');g.addColorStop(.5,'rgba(255,240,200,.35)');g.addColorStop(1,'rgba(255,240,200,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
    ctx.globalCompositeOperation='lighter';
    /* glints popping on the bars and the chain */
    for(var k=0;k<spots.length;k++){var per=2.2+rnd(k,1)*2.6,e=((t+rnd(k,2)*per)%per)/.55;if(e<1)glint(spots[k][0],spots[k][1],4+rnd(k,3)*5,Math.sin(Math.PI*e))}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';vignette(.3);
  }
  fit();window.addEventListener('resize',fit);
  return {draw:function(t){if(cv.clientWidth!==cw||cv.clientHeight!==ch)fit();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);(kind==='lava'?lava:kind==='xmas'?xmas:kind==='gold'?goldv:space)(t)}};
};
