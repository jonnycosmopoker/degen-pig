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

  /* ---------- Tropical Lagoon: a shallow turquoise lagoon over rippled sand, ringed by a beach. Caustic light shimmers on the
     bottom, a palm frond's shadow sways across one corner, foam laps at the shore, and the water rings out wherever a die
     lands, hits the rail or skids along (ripple() is called by the dice code). ---------- */
  var RIP=[],TT=0,SH=null,SHk='',BC=null,cpat=null,spat=null;
  function shore(){
    var k=cw+'x'+ch;if(SHk===k)return SH;SHk=k;SH=[];
    var I=Math.max(16,Math.min(34,Math.min(cw,ch)*.075)),R=I*1.9,x0=I,y0=I,x1=cw-I,y1=ch-I,s=0;
    function push(x,y,nx,ny){var w=Math.sin(s*.045)*4+Math.sin(s*.11+1)*2.4+Math.sin(s*.023+2)*3;SH.push({x:x+nx*w,y:y+ny*w,nx:nx,ny:ny});s+=6}
    function line(ax,ay,bx,by,nx,ny){var L=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.round(L/6));for(var i=0;i<n;i++)push(ax+(bx-ax)*i/n,ay+(by-ay)*i/n,nx,ny)}
    function arc(cx,cy,a0,a1){var n=Math.max(2,Math.round(R*Math.abs(a1-a0)/6));for(var i=0;i<n;i++){var a=a0+(a1-a0)*i/n;push(cx+Math.cos(a)*R,cy+Math.sin(a)*R,-Math.cos(a),-Math.sin(a))}}
    line(x0+R,y0,x1-R,y0,0,1);arc(x1-R,y0+R,-Math.PI/2,0);line(x1,y0+R,x1,y1-R,-1,0);arc(x1-R,y1-R,0,Math.PI/2);
    line(x1-R,y1,x0+R,y1,0,-1);arc(x0+R,y1-R,Math.PI/2,Math.PI);line(x0,y1-R,x0,y0+R,1,0);arc(x0+R,y0+R,Math.PI,Math.PI*1.5);
    BC=null;return SH}
  function shorePath(c,off){c.beginPath();for(var i=0;i<SH.length;i++){var p=SH[i];c[i?'lineTo':'moveTo'](p.x+p.nx*off,p.y+p.ny*off)}c.closePath()}
  function beach(){
    if(BC)return BC;BC=document.createElement('canvas');BC.width=Math.round(cw*dpr);BC.height=Math.round(ch*dpr);var b=BC.getContext('2d');b.setTransform(dpr,0,0,dpr,0,0);
    var sp=b.createPattern(A.sand,'repeat');sp.setTransform(new DOMMatrix().scale(.42));b.fillStyle=sp;b.fillRect(0,0,cw,ch);
    var lg=b.createLinearGradient(0,0,cw,ch);lg.addColorStop(0,'rgba(255,248,225,.18)');lg.addColorStop(1,'rgba(120,90,40,.12)');b.fillStyle=lg;b.fillRect(0,0,cw,ch);
    /* wet sand darkening toward the water */
    [[18,'rgba(110,84,48,.16)'],[11,'rgba(100,76,44,.2)'],[6,'rgba(90,70,40,.24)']].forEach(function(w){b.lineWidth=w[0];b.strokeStyle=w[1];shorePath(b,0);b.stroke()});
    b.globalCompositeOperation='destination-out';b.fillStyle='#000';shorePath(b,0);b.fill();
    b.globalCompositeOperation='source-over';return BC}
  function lagoon(t){
    TT=t;shore();
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;cover(A.bed,1.02,Math.sin(t*.2)*3,Math.cos(t*.17)*2);
    /* the water: deeper turquoise in the middle, clear green-blue in the shallows */
    var g=ctx.createRadialGradient(cw*.52,ch*.5,Math.min(cw,ch)*.1,cw*.5,ch*.5,Math.hypot(cw,ch)*.55);
    g.addColorStop(0,'rgba(4,124,168,.54)');g.addColorStop(.6,'rgba(14,172,196,.4)');g.addColorStop(1,'rgba(70,220,210,.26)');ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
    /* caustic light on the bottom: two nets drifting against each other */
    if(!cpat)cpat=ctx.createPattern(A.caus,'repeat');
    ctx.globalCompositeOperation='lighter';
    var s1=.62,ts1=512*s1;ctx.globalAlpha=.3;cpat.setTransform(new DOMMatrix().translate((t*9)%ts1,(t*4)%ts1).scale(s1));ctx.fillStyle=cpat;ctx.fillRect(0,0,cw,ch);
    var s2=.85,ts2=512*s2;ctx.globalAlpha=.22;cpat.setTransform(new DOMMatrix().translate(-(t*6)%ts2,(t*8)%ts2).rotate(23).scale(s2));ctx.fillRect(0,0,cw,ch);
    ctx.globalAlpha=1;
    /* sun glints dancing on the surface */
    for(var k=0;k<18;k++){var per=1.4+rnd(k,1)*2.2,e=((t+rnd(k,2)*per)%per)/.5;if(e>=1)continue;var c=Math.floor((t+rnd(k,2)*per)/per),gx=(rnd(k,c+3)*.8+.1)*cw,gy=(rnd(k,c+5)*.8+.1)*ch,a=Math.sin(Math.PI*e),sz=2+rnd(k,4)*3;
      var gg=ctx.createRadialGradient(gx,gy,0,gx,gy,sz*3);gg.addColorStop(0,'rgba(255,255,255,'+(a*.75)+')');gg.addColorStop(1,'rgba(220,255,255,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.arc(gx,gy,sz*3,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,'+(a*.7)+')';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(gx-sz*2.4,gy);ctx.lineTo(gx+sz*2.4,gy);ctx.moveTo(gx,gy-sz*1.6);ctx.lineTo(gx,gy+sz*1.6);ctx.stroke()}
    /* ripples: rings of light and shade spreading out, plus a few drops thrown up by a hard landing */
    for(var i=RIP.length-1;i>=0;i--){var q=RIP[i],ag=t-q.t0;if(ag<0)ag=0;var life=1.3+q.s*1.4;if(ag>life){RIP.splice(i,1);continue}
      var f=1-ag/life,sp=55+75*q.s;
      for(var j=0;j<3;j++){var r=(ag-j*.16)*sp;if(r<=1)continue;var al=Math.pow(f,1.4)*(.25+.6*q.s)*(1-j*.28);
        ctx.globalCompositeOperation='source-over';ctx.strokeStyle='rgba(0,70,95,'+(al*.45)+')';ctx.lineWidth=2.6*f+1;ctx.beginPath();ctx.ellipse(q.x,q.y+1.5,r*.98,r*.9,0,0,TAU);ctx.stroke();
        ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba(225,255,255,'+(al*.8)+')';ctx.lineWidth=1.8*f+.6;ctx.beginPath();ctx.ellipse(q.x,q.y-1,r,r*.92,0,0,TAU);ctx.stroke()}
      if(q.s>.55&&ag<.6){ctx.globalCompositeOperation='lighter';for(var d=0;d<10;d++){var an=rnd(d,q.k)*TAU,v=(40+rnd(d,q.k+1)*70)*q.s,dx=Math.cos(an)*v*ag,dy=Math.sin(an)*v*ag-(1-Math.pow(1-ag/.6,2))*6,al2=(1-ag/.6);
        ctx.fillStyle='rgba(235,255,255,'+(al2*.85)+')';ctx.beginPath();ctx.arc(q.x+dx,q.y+dy,1.2+rnd(d,q.k+2)*1.6,0,TAU);ctx.fill()}}}
    /* a palm frond's shadow, swaying over the top right */
    ctx.globalCompositeOperation='source-over';var ps=Math.max(cw,ch)*.95;ctx.save();ctx.translate(cw+ps*.02,-ps*.06);ctx.rotate(Math.sin(t*.7)*.035+Math.sin(t*1.9)*.01);ctx.globalAlpha=.95;ctx.drawImage(A.palm,-ps*.96,0,ps,ps);ctx.restore();ctx.globalAlpha=1;
    /* the beach, then foam lapping at the shoreline */
    ctx.drawImage(beach(),0,0,cw,ch);
    var lap=(1+Math.sin(t*1.25))*.5;
    ctx.globalCompositeOperation='source-over';ctx.lineJoin='round';
    ctx.strokeStyle='rgba(255,255,255,'+(.32+.25*lap)+')';ctx.lineWidth=2.6;shorePath(ctx,1+lap*4);ctx.stroke();
    ctx.setLineDash([16,9,6,11]);ctx.lineDashOffset=-t*8;ctx.strokeStyle='rgba(255,255,255,'+(.28+.2*(1-lap))+')';ctx.lineWidth=1.8;shorePath(ctx,7+lap*5);ctx.stroke();
    ctx.setLineDash([]);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=5;shorePath(ctx,-1);ctx.stroke();
    vignette(.16);
  }
  function ripple(x,y,s){if(RIP.length>40)RIP.shift();RIP.push({x:x,y:y,s:Math.max(.08,Math.min(1,s)),t0:TT,k:Math.floor(Math.random()*90)+3})}

  /* ---------- Neon Pink / Neon Green: black glass under a buzzing neon tube that hums and now and then flickers, a faint
     lit grid, a light that sweeps across the glass, and a ring of neon that flashes out wherever a die lands. ---------- */
  var NC=kind==='neong'?['57,255,136','190,255,60']:['255,46,170','170,70,255'],NB=null,NBk='',NR=[];
  function nbase(){var k=cw+'x'+ch;if(NBk===k&&NB)return NB;NBk=k;NB=document.createElement('canvas');NB.width=Math.round(cw*dpr);NB.height=Math.round(ch*dpr);
    var b=NB.getContext('2d');b.setTransform(dpr,0,0,dpr,0,0);var g=b.createLinearGradient(0,0,cw*.3,ch);g.addColorStop(0,'#0C0912');g.addColorStop(.5,'#06050A');g.addColorStop(1,'#0A0810');b.fillStyle=g;b.fillRect(0,0,cw,ch);
    var sp=26;b.strokeStyle='rgba('+NC[0]+',.07)';b.lineWidth=1;b.beginPath();for(var x=(cw%sp)/2;x<cw;x+=sp){b.moveTo(x+.5,0);b.lineTo(x+.5,ch)}for(var y=(ch%sp)/2;y<ch;y+=sp){b.moveTo(0,y+.5);b.lineTo(cw,y+.5)}b.stroke();
    b.fillStyle='rgba('+NC[0]+',.16)';for(x=(cw%sp)/2;x<cw;x+=sp)for(y=(ch%sp)/2;y<ch;y+=sp){b.fillRect(x-.5,y-.5,2,2)}
    return NB}
  function nflick(t,ph){var k=Math.floor(t*14+ph*50),r=rnd(k,7+ph);if(r>.972)return .3;if(r>.955)return .65;return .94+.06*rnd(k,9+ph)}
  function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
  function tube(c,col,I,R,w,f){rrect(c,I,I,cw-2*I,ch-2*I,R);c.shadowColor='rgba('+col+',1)';c.shadowBlur=26*f;c.strokeStyle='rgba('+col+','+(.85*f)+')';c.lineWidth=w;c.stroke();
    c.shadowBlur=10*f;c.strokeStyle='rgba(255,245,252,'+(.85*f)+')';c.lineWidth=Math.max(1.2,w*.32);c.stroke();c.shadowBlur=0}
  function neon(t){
    TT=t;ctx.globalCompositeOperation='source-over';ctx.drawImage(nbase(),0,0,cw,ch);
    var f=nflick(t,0),f2=nflick(t+3.1,1),br=.75+.25*Math.sin(t*1.3);
    /* the glow the tube throws on the glass */
    var g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*.15,cw/2,ch/2,Math.hypot(cw,ch)*.55);g.addColorStop(0,'rgba('+NC[0]+','+(.05*br)+')');g.addColorStop(.75,'rgba('+NC[0]+','+(.09*f)+')');g.addColorStop(1,'rgba('+NC[0]+','+(.22*f)+')');ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
    /* a slow light sweep across the glass */
    var sw=((t%7)/7)*(cw+ch)*1.6-(cw+ch)*.3;ctx.save();ctx.translate(sw,0);ctx.rotate(.5);var lg=ctx.createLinearGradient(-60,0,60,0);lg.addColorStop(0,'rgba(255,255,255,0)');lg.addColorStop(.5,'rgba(255,255,255,.05)');lg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=lg;ctx.fillRect(-60,-ch*2,120,ch*4);ctx.restore();
    /* neon rings where the dice land */
    ctx.globalCompositeOperation='lighter';
    for(var i=NR.length-1;i>=0;i--){var q=NR[i],ag=t-q.t0;if(ag<0)ag=0;var life=.55+q.s*.45;if(ag>life){NR.splice(i,1);continue}var e=ag/life,a=Math.pow(1-e,1.6);
      var pg=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,40+50*q.s);pg.addColorStop(0,'rgba('+NC[0]+','+(.35*a)+')');pg.addColorStop(1,'rgba('+NC[0]+',0)');ctx.fillStyle=pg;ctx.beginPath();ctx.arc(q.x,q.y,40+50*q.s,0,TAU);ctx.fill();
      for(var j=0;j<2;j++){var r=(14+e*(70+80*q.s))*(1-j*.35);ctx.shadowColor='rgba('+NC[j]+',1)';ctx.shadowBlur=14;ctx.strokeStyle='rgba('+NC[j]+','+(a*(j?.6:.9))+')';ctx.lineWidth=(j?1.6:2.6)*(1-e*.5);ctx.beginPath();ctx.arc(q.x,q.y,r,0,TAU);ctx.stroke()}
      ctx.shadowBlur=0}
    /* the tubes: the main colour on the outside, a thinner accent tube inside it, and the little brackets holding them */
    ctx.globalCompositeOperation='source-over';
    tube(ctx,NC[0],11,26,6,f);tube(ctx,NC[1],22,18,2.6,f2*.85);
    ctx.fillStyle='rgba(30,26,36,.95)';for(var k=0;k<4;k++){var bx=[cw*.3,cw*.7][k%2],by=k<2?11:ch-11;ctx.fillRect(bx-4,by-5,8,10)}
    for(k=0;k<2;k++){var by2=ch*[.35,.65][k];ctx.fillRect(7,by2-4,10,8);ctx.fillRect(cw-17,by2-4,10,8)}
    vignette(.28);
  }
  function nring(x,y,s){if(s<.3)return;if(NR.length>12)NR.shift();NR.push({x:x,y:y,s:Math.min(1,s),t0:TT})}

  /* ---------- High Roller craps table: a padded mahogany rail with a brass trim, rubber pyramids lining the wall, and a green
     felt craps layout with gold-foil lettering. A glint runs round the brass, the gold lettering catches a passing light, and
     soft spotlights breathe over the felt. ---------- */
  var CF=null,CR=null,CP=null,GC=null,CT=0,CHIPS=[],HQ=[],HAND=null,LG={s:1,sx:1,sy:1,x:0,y:0};
  /* where a chip goes for each roll total, in layout units: the place numbers, the field numbers, and 7 on the pass line */
  var BW=1010/6,FW=1010/7,SPOT={4:[150+BW*.5,302],5:[150+BW*1.5,302],6:[150+BW*2.5,302],8:[150+BW*3.5,302],9:[150+BW*4.5,302],10:[150+BW*5.5,302],
    2:[150+FW*.5+34,572],3:[150+FW*1.5+30,572],11:[150+FW*5.5+30,572],12:[150+FW*6.5-34,572],7:[860,866]};
  var CHC={2:'#2B6CD9',3:'#7A3FC4',4:'#D9262E',5:'#1F8F4E',6:'#D9262E',7:'#E07A12',8:'#1F8F4E',9:'#1C1C20',10:'#2B6CD9',11:'#7A3FC4',12:'#1C1C20'};
  function chip(x,y,r,col,a){ctx.save();ctx.globalAlpha=a==null?1:a;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(x+r*.12,y+r*.22,r,r*.92,0,0,TAU);ctx.fill();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    ctx.fillStyle='#F4F1EA';for(var k=0;k<6;k++){ctx.save();ctx.translate(x,y);ctx.rotate(k*TAU/6);ctx.fillRect(-r*.16,-r,r*.32,r*.3);ctx.restore()}
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=Math.max(1,r*.08);ctx.setLineDash([r*.22,r*.16]);ctx.beginPath();ctx.arc(x,y,r*.66,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r*.56,0,TAU);ctx.fill();
    var hg=ctx.createRadialGradient(x-r*.3,y-r*.35,0,x,y,r);hg.addColorStop(0,'rgba(255,255,255,.35)');hg.addColorStop(.6,'rgba(255,255,255,0)');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    ctx.restore()}
  function cxy(n,k){var p=SPOT[n];return [LG.x+p[0]*LG.sx,LG.y+p[1]*LG.sy-k*8*LG.s]}
  function hstep(){if(!HAND&&HQ.length){HAND=HQ.shift();HAND.t0=CT}}
  function ease(e){return e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2}
  /* the dealer's gloved hand reaching in from the top of the table */
  function drawHand(x,y,sc2){var w=230*sc2,h=430*sc2;ctx.drawImage(A.hand,x-103*sc2,y-345*sc2,w,h)}
  function chipsAndHand(){
    var r=Math.max(10,46*LG.s),sc2=r/28;
    CHIPS.forEach(function(c){if(c.held)return;var e=Math.min(1,(CT-c.t0)/.25),p=cxy(c.n,c.k),a=1,dy=0;
      if(c.gone!=null){var g=Math.min(1,(CT-c.gone)/.5);a=1-g;dy=-g*40}
      chip(p[0],p[1]+dy-(1-e)*6,r*(1+.12*(1-e)),CHC[c.n],a)});
    CHIPS=CHIPS.filter(function(c){return c.gone==null||CT-c.gone<.5});
    if(HAND){var e=(CT-HAND.t0)/1.05;if(e>=1){if(!HAND.done){if(HAND.kind==='place'){HAND.c.held=false;HAND.c.t0=CT}else CHIPS.forEach(function(c){if(c.gone==null)c.gone=CT})}HAND=null;hstep();return}
      var tx,ty;if(HAND.kind==='place'){var p=cxy(HAND.n,HAND.k);tx=p[0];ty=p[1]}else{tx=LG.x+655*LG.sx;ty=LG.y+420*LG.sy}
      var top=-430*sc2*.15,k=e<.42?ease(e/.42):e<.58?1:1-ease((e-.58)/.42),hy=top+(ty-top)*k,hx=tx+(1-k)*20;
      if(HAND.kind==='place'){if(e<.5){chip(hx,hy,r,CHC[HAND.n])}else if(!HAND.done){HAND.done=true;HAND.c.held=false;HAND.c.t0=CT}}
      else if(e>.45&&!HAND.done){HAND.done=true;CHIPS.forEach(function(c){if(c.gone==null)c.gone=CT})}
      drawHand(hx,hy,sc2)}
    hstep();
  }
  function crapsMark(n){if(!SPOT[n])return;var k=CHIPS.filter(function(c){return c.n===n&&c.gone==null}).length;var c={n:n,k:Math.min(k,7),t0:0,held:true};CHIPS.push(c);HQ.push({kind:'place',n:n,k:c.k,c:c})}
  function crapsClear(){if(!CHIPS.some(function(c){return c.gone==null}))return;HQ=HQ.filter(function(h){return h.kind!=='place'});CHIPS=CHIPS.filter(function(c){return !c.held});HQ.push({kind:'sweep'})}
  function crapsGeo(){var I=Math.max(16,Math.min(30,Math.min(cw,ch)*.075)),PW=Math.max(7,I*.4);return {I:I,PW:PW,fx:I+PW,fy:I+PW,fw:cw-2*(I+PW),fh:ch-2*(I+PW)}}
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
  function craps(t){
    CT=t;var g=crapsGeo();
    if(!CF){CF=ctx.createPattern(A.felt,'repeat');CR=ctx.createPattern(A.rail,'repeat');CP=ctx.createPattern(A.pyr,'repeat')}
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    /* the rail: mahogany with a padded roll of light along it */
    CR.setTransform(new DOMMatrix().scale(.5));ctx.fillStyle=CR;ctx.fillRect(0,0,cw,ch);
    var rg=ctx.createLinearGradient(0,0,0,ch);rg.addColorStop(0,'rgba(255,220,180,.14)');rg.addColorStop(.5,'rgba(0,0,0,0)');rg.addColorStop(1,'rgba(0,0,0,.25)');ctx.fillStyle=rg;ctx.fillRect(0,0,cw,ch);
    ctx.lineWidth=g.I*.5;ctx.strokeStyle='rgba(255,210,170,.08)';rr(ctx,g.I*.35,g.I*.35,cw-g.I*.7,ch-g.I*.7,g.I*.9);ctx.stroke();
    /* the rubber pyramids lining the wall */
    CP.setTransform(new DOMMatrix().scale(g.PW/16));ctx.fillStyle=CP;rr(ctx,g.I,g.I,cw-2*g.I,ch-2*g.I,8);ctx.fill();
    /* the felt */
    ctx.save();rr(ctx,g.fx,g.fy,g.fw,g.fh,5);ctx.clip();
    CF.setTransform(new DOMMatrix().scale(.75));ctx.fillStyle=CF;ctx.fillRect(g.fx,g.fy,g.fw,g.fh);
    /* the layout's outer line (40..1160 x 40..920 in layout units) runs to within a few pixels of the left and right edges of the felt */
    var sx=(g.fw-8)/1120,sy=Math.min(sx,(g.fh-8)/880),s=Math.min(sx,sy),lw=1200*sx,lh=960*sy,lx=g.fx+4-40*sx,ly=g.fy+(g.fh-880*sy)/2-40*sy;
    ctx.drawImage(A.lay,lx,ly,lw,lh);LG={s:s,sx:sx,sy:sy,x:lx,y:ly};
    /* the table's name, small and faint, in the open Come area between the place numbers and the field */
    var fs=Math.min(84*sy,560*sx/5.6);ctx.save();ctx.font=fs+'px "Bowlby One",Figtree,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(246,207,69,.22)';ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowOffsetY=Math.max(1,fs*.05);ctx.fillText('DEGEN PIG',lx+712*sx,ly+447*sy);ctx.restore();
    /* the gold lettering catches a light passing across */
    if(!GC){GC=document.createElement('canvas')}
    if(GC.width!==cv.width||GC.height!==cv.height){GC.width=cv.width;GC.height=cv.height}
    var gx=GC.getContext('2d');gx.setTransform(dpr,0,0,dpr,0,0);gx.globalCompositeOperation='source-over';gx.clearRect(0,0,cw,ch);gx.drawImage(A.gold,lx,ly,lw,lh);
    var u=(t%6)/6,bx=lx-lw*.4+u*lw*1.9;gx.globalCompositeOperation='source-in';
    var sg=gx.createLinearGradient(bx-70,ly,bx+70,ly+lh*.35);sg.addColorStop(0,'rgba(255,250,220,0)');sg.addColorStop(.5,'rgba(255,250,220,.95)');sg.addColorStop(1,'rgba(255,250,220,0)');gx.fillStyle=sg;gx.fillRect(0,0,cw,ch);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.75;ctx.drawImage(GC,0,0,cw,ch);ctx.globalAlpha=1;
    /* two soft spotlights breathing over the felt */
    ctx.globalCompositeOperation='soft-light';
    for(var k=0;k<2;k++){var cx=g.fx+g.fw*(k?.72:.3),cy=g.fy+g.fh*(k?.62:.38),R=Math.max(g.fw,g.fh)*.55,a=.32+.1*Math.sin(t*.9+k*2.1);
      var lg=ctx.createRadialGradient(cx,cy,0,cx,cy,R);lg.addColorStop(0,'rgba(255,245,215,'+a+')');lg.addColorStop(1,'rgba(255,245,215,0)');ctx.fillStyle=lg;ctx.fillRect(g.fx,g.fy,g.fw,g.fh)}
    ctx.globalCompositeOperation='source-over';
    var ig=ctx.createLinearGradient(0,g.fy,0,g.fy+14);ig.addColorStop(0,'rgba(0,0,0,.45)');ig.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=ig;ctx.fillRect(g.fx,g.fy,g.fw,14);
    ctx.restore();
    /* the brass trim round the felt, with a glint that runs round it */
    rr(ctx,g.fx-1.5,g.fy-1.5,g.fw+3,g.fh+3,6);
    var bg=ctx.createLinearGradient(0,0,cw,ch);bg.addColorStop(0,'#FFF0B0');bg.addColorStop(.3,'#D9A630');bg.addColorStop(.55,'#8A5A0A');bg.addColorStop(.75,'#F2D27A');bg.addColorStop(1,'#A87418');
    ctx.strokeStyle=bg;ctx.lineWidth=3;ctx.stroke();
    rr(ctx,g.I-1,g.I-1,cw-2*g.I+2,ch-2*g.I+2,9);ctx.lineWidth=2.5;ctx.stroke();
    var per=2*(g.fw+g.fh),d=((t%5)/5)*per,px,py;
    if(d<g.fw){px=g.fx+d;py=g.fy}else if(d<g.fw+g.fh){px=g.fx+g.fw;py=g.fy+d-g.fw}else if(d<2*g.fw+g.fh){px=g.fx+g.fw-(d-g.fw-g.fh);py=g.fy+g.fh}else{px=g.fx;py=g.fy+g.fh-(d-2*g.fw-g.fh)}
    ctx.globalCompositeOperation='lighter';var hg=ctx.createRadialGradient(px,py,0,px,py,26);hg.addColorStop(0,'rgba(255,250,220,.95)');hg.addColorStop(.3,'rgba(255,220,140,.45)');hg.addColorStop(1,'rgba(255,200,100,0)');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(px,py,26,0,TAU);ctx.fill();
    for(var j=0;j<6;j++){var per2=2.4+rnd(j,1)*2,e=((t+rnd(j,2)*per2)%per2)/.5;if(e>=1)continue;var side=j%4,q=rnd(j,Math.floor((t+rnd(j,2)*per2)/per2)+3),sx2,sy2;
      if(side===0){sx2=g.I+q*(cw-2*g.I);sy2=g.I}else if(side===1){sx2=cw-g.I;sy2=g.I+q*(ch-2*g.I)}else if(side===2){sx2=g.I+q*(cw-2*g.I);sy2=ch-g.I}else{sx2=g.I;sy2=g.I+q*(ch-2*g.I)}
      var a2=Math.sin(Math.PI*e),sz=5+rnd(j,4)*5;ctx.strokeStyle='rgba(255,250,225,'+a2+')';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(sx2-sz,sy2);ctx.lineTo(sx2+sz,sy2);ctx.moveTo(sx2,sy2-sz*.7);ctx.lineTo(sx2,sy2+sz*.7);ctx.stroke()}
    ctx.globalCompositeOperation='source-over';vignette(.22);
    chipsAndHand();
  }

  /* ---------- Arcade Retro: a CRT screen in an arcade bezel. Pixel stars twinkle over a synthwave grid that scrolls toward you,
     scanlines and a soft flicker sit on top, INSERT COIN blinks, and every roll pops an arcade score (+8, +16 2X, GAME OVER). ---------- */
  var PF={'0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100110010001000011111','3':'11110000010000101110000010000111110',
    '4':'00010001100101010010111110001000010','5':'11111100001111000001000011000101110','6':'00110010001000011110100011000101110','7':'11111000010001000100010000100001000',
    '8':'01110100011000101110100011000101110','9':'01110100011000101111000010001001100','+':'00000001000010011111001000010000000','X':'10001100010101000100010101000110001',
    '!':'00100001000010000100001000000000100','G':'01110100011000010111100011000101111','A':'01110100011000111111100011000110001','M':'10001110111010110101100011000110001',
    'E':'11111100001000011110100001000011111','O':'01110100011000110001100011000101110','V':'10001100011000110001100010101000100','R':'11110100011000111110101001001010001',
    'D':'11110100011000110001100011000111110','P':'11110100011000111110100001000010000','I':'01110001000010000100001000010001110','N':'10001110011010110011100011000110001',
    'S':'01111100001000001110000010000111110','C':'01110100011000010000100001000101110','T':'11111001000010000100001000010000100','U':'10001100011000110001100011000101110',
    'H':'10001100011000111111100011000110001','L':'10000100001000010000100001000011111',' ':'00000000000000000000000000000000000'};
  function ptext(c,str,x,y,px,col,glow){var w=str.length*6*px-px;x-=w/2;y-=3.5*px;c.fillStyle=col;if(glow){c.shadowColor=glow;c.shadowBlur=px*3}
    for(var i=0;i<str.length;i++){var g=PF[str[i]]||PF[' '];for(var r=0;r<7;r++)for(var k=0;k<5;k++)if(g[r*5+k]==='1')c.fillRect(Math.round(x+(i*6+k)*px),Math.round(y+r*px),Math.ceil(px),Math.ceil(px))}
    c.shadowBlur=0}
  var AB=null,ABk='',SL=null,POPS=[];
  function abase(){var k=cw+'x'+ch;if(AB&&ABk===k)return AB;ABk=k;AB=document.createElement('canvas');AB.width=Math.round(cw*dpr);AB.height=Math.round(ch*dpr);
    var b=AB.getContext('2d');b.setTransform(dpr,0,0,dpr,0,0);var g=b.createLinearGradient(0,0,0,ch);g.addColorStop(0,'#0B0420');g.addColorStop(.55,'#1A0636');g.addColorStop(.62,'#2A0846');g.addColorStop(1,'#07020F');b.fillStyle=g;b.fillRect(0,0,cw,ch);
    /* a pixel sun sinking behind the horizon */
    var hz=ch*.6,sr=Math.min(cw,ch)*.2,sx=cw/2;for(var y=hz-sr;y<hz;y+=4){var dy=hz-y,half=Math.sqrt(Math.max(0,sr*sr-(sr-dy)*(sr-dy)));var cut=(y>hz-sr*.55)&&(Math.floor((y-(hz-sr))/4)%3===0);if(cut)continue;
      var f=(y-(hz-sr))/sr;b.fillStyle='rgb('+Math.round(255)+','+Math.round(210-150*f)+','+Math.round(80+90*f)+')';b.globalAlpha=.85;b.fillRect(Math.round(sx-half),Math.round(y),Math.round(half*2),4)}
    b.globalAlpha=1;return AB}
  function scan(){var k=cw+'x'+ch;if(SL&&SL.k===k)return SL.c;var c=document.createElement('canvas');c.width=Math.round(cw*dpr);c.height=Math.round(ch*dpr);var b=c.getContext('2d');b.setTransform(dpr,0,0,dpr,0,0);
    b.fillStyle='rgba(0,0,0,.28)';for(var y=0;y<ch;y+=3)b.fillRect(0,y,cw,1);SL={k:k,c:c};return c}
  function arcade(t){
    TT=t;ctx.globalCompositeOperation='source-over';ctx.drawImage(abase(),0,0,cw,ch);
    var hz=ch*.6,px=Math.max(2,Math.round(Math.min(cw,ch)/150));
    /* pixel stars */
    for(var i=0;i<46;i++){var x=Math.floor(rnd(i,1)*cw/px)*px,y=Math.floor(rnd(i,2)*hz*.9/px)*px,tw=.5+.5*Math.sin(t*(1.5+rnd(i,3)*3)+i);if(tw<.15)continue;ctx.fillStyle='rgba('+(rnd(i,4)<.3?'120,240,255':rnd(i,4)<.5?'255,120,230':'255,255,255')+','+tw.toFixed(2)+')';ctx.fillRect(x,y,px,px)}
    /* synthwave grid scrolling toward you */
    ctx.save();ctx.beginPath();ctx.rect(0,hz,cw,ch-hz);ctx.clip();ctx.strokeStyle='rgba(255,60,220,.8)';ctx.shadowColor='rgba(255,60,220,1)';ctx.shadowBlur=8;ctx.lineWidth=1.5;
    var sc=(t*.35)%1;for(var j=0;j<14;j++){var z=(j+1-sc)/14,yy=hz+(ch-hz)*Math.pow(z,2.2);ctx.globalAlpha=Math.min(1,z*1.6);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(cw,yy);ctx.stroke()}
    ctx.globalAlpha=1;for(var v=-10;v<=10;v++){ctx.beginPath();ctx.moveTo(cw/2+v*cw*.045,hz);ctx.lineTo(cw/2+v*cw*.32,ch);ctx.stroke()}
    ctx.restore();ctx.fillStyle='rgba(120,240,255,.9)';ctx.fillRect(0,hz-1,cw,2);
    /* title and INSERT COIN */
    var tp=Math.max(2,Math.floor(Math.min(cw/72,ch/40)));
    ptext(ctx,'DEGEN PIG',cw/2+tp*.6,ch*.3+tp*.6,tp,'rgba(255,40,200,.55)');ptext(ctx,'DEGEN PIG',cw/2,ch*.3,tp,'rgba(140,250,255,.5)','rgba(80,230,255,.8)');
    if(Math.floor(t*1.6)%2===0)ptext(ctx,'INSERT COIN',cw/2,ch-Math.max(16,tp*5),Math.max(1.5,tp*.42),'rgba(255,230,90,.9)','rgba(255,200,60,.8)');
    ptext(ctx,'1UP',Math.max(26,tp*5),Math.max(14,tp*4),Math.max(1.5,tp*.42),'rgba(255,80,80,'+(Math.floor(t*2)%2?.95:.4)+')');
    /* score pops */
    for(var q=POPS.length-1;q>=0;q--){var P0=POPS[q],e=(t-P0.t0)/1.3;if(e<0)continue;if(e>=1){POPS.splice(q,1);continue}
      var s=Math.max(2,Math.round(Math.min(cw,ch)/80))*(e<.12?1+(1-e/.12)*.8:1),a=e>.7?1-(e-.7)/.3:1;ctx.globalAlpha=a;
      ptext(ctx,P0.s,P0.x+s*.7,P0.y-e*36+s*.7,s,'rgba(0,0,0,.7)');ptext(ctx,P0.s,P0.x,P0.y-e*36,s,P0.c,P0.g);ctx.globalAlpha=1}
    /* scanlines, a soft CRT flicker, the curved-glass shine */
    ctx.drawImage(scan(),0,0,cw,ch);ctx.fillStyle='rgba(255,255,255,'+(.012+.012*Math.sin(t*60))+')';ctx.fillRect(0,0,cw,ch);
    var gl=ctx.createRadialGradient(cw*.3,ch*.2,0,cw*.3,ch*.2,Math.max(cw,ch)*.6);gl.addColorStop(0,'rgba(255,255,255,.06)');gl.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gl;ctx.fillRect(0,0,cw,ch);
    vignette(.55);
  }
  function apop(x,y,s,kind){if(POPS.length>6)POPS.shift();var hw=s.length*3.2*Math.max(2,Math.round(Math.min(cw,ch)/80));x=Math.max(hw+8,Math.min(cw-hw-8,x));y=Math.max(ch*.5,Math.min(ch*.82,y));POPS.push({x:x,y:y,s:s,t0:TT,c:kind==='gold'?'#FFE14A':kind==='bad'?'#FF4A5A':'#7CF6FF',g:kind==='gold'?'rgba(255,200,40,.9)':kind==='bad'?'rgba(255,40,60,.9)':'rgba(60,230,255,.9)'})}
  fit();window.addEventListener('resize',fit);
  return {pop:kind==='arcade'?apop:null,mark:kind==='craps'?crapsMark:null,clear:kind==='craps'?crapsClear:null,ripple:kind==='lagoon'?ripple:kind==='neonp'||kind==='neong'?nring:null,draw:function(t){if(cv.clientWidth!==cw||cv.clientHeight!==ch)fit();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);(kind==='lava'?lava:kind==='xmas'?xmas:kind==='gold'?goldv:kind==='lagoon'?lagoon:kind==='neonp'||kind==='neong'?neon:kind==='craps'?craps:kind==='arcade'?arcade:space)(t)}};
};
