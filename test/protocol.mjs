const B='http://localhost:8790', W='ws://localhost:8790';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a);
function client(name,uid,code,pw,opts={}){
  const c={name,uid,last:null,errors:[],ended:null,notes:[],unlocks:[],timers:0};
  c.open=()=>new Promise(res=>{c.ws=new WebSocket(W+'/ws/table/'+code);c.ws.onopen=()=>{c.ws.send(JSON.stringify({t:'hello',token:'dev-'+uid.toLowerCase(),name,pw}));res()};
    c.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t==='state'){c.last=m;if(m.ev&&m.ev.note)c.notes.push(m.ev.note);if(m.ev&&m.ev.unlocks)c.unlocks.push(...m.ev.unlocks)}else if(m.t==='error')c.errors.push(m.msg);else if(m.t==='ended')c.ended=m.reason;else if(m.t==='timer')c.timers++}});
  c.send=o=>c.ws.send(JSON.stringify(o));
  return c;
}
async function create(o){const r=await fetch(B+'/api/tables',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer dev-ua'},body:JSON.stringify(o)});return (await r.json()).code}
async function play(cs,{idle=null,until='over'}={}){
  // each human: when it's their turn, roll until 15+ then lock
  for(let k=0;k<4000;k++){
    await sleep(25);
    const m=cs[0].last; if(!m) continue; const s=m.s;
    if(until==='over'&&s&&s.phase==='over')return true;
    if(cs.some(c=>c.ended))return false;
    for(const c of cs){ if(!c.last||!c.last.s||c===idle)continue; const st=c.last.s; if(st.phase!=='play'&&st.phase!=='final')continue;
      if(st.cur!==c.last.you||st.players[c.last.you].away)continue;
      if(st.bust)continue; if(st.pend){c.send({t:'reroll'});continue}
      if(st.turn>=15&&!st.mustRoll)c.send({t:'lock'});else c.send({t:'roll'}); }
  }
  return false;
}
(async()=>{
  // public lobby + private password + start early
  const code=await create({name:'Monday Game',seats:4,private:true,password:'oink',rules:{target:100,timer:15,power:true},hostUid:'uA',hostName:'Ace'});
  let lob=await (await fetch(B+'/api/lobby')).json(); log('lobby:',JSON.stringify(lob.tables.map(t=>[t.name,t.locked,t.filled+'/'+t.seats])));
  const A=client('Ace','uA',code,''),Bx=client('Bex','uB',code,'nope'); await A.open(); await Bx.open(); await sleep(150);
  log('wrong pw ->',Bx.errors);
  const B2=client('Bex','uB',code,'oink'); await B2.open(); await sleep(150);
  log('seats:',A.last.meta.players.map(p=>p.name+(p.host?'*':'')).join(', '));
  lob=await (await fetch(B+'/api/lobby')).json(); log('lobby filled:',lob.tables[0].filled);
  B2.send({t:'start'}); await sleep(100); log('non-host start ignored, status:',A.last.meta.status);
  A.send({t:'start'}); await sleep(200); log('started:',A.last.meta.status,A.last.meta.players.map(p=>p.name+(p.cpu?'(cpu)':'')).join(', '));
  lob=await (await fetch(B+'/api/lobby')).json(); log('lobby after start:',lob.tables.length);
  // game 1 with Bex idle -> timeouts
  let ok=await play([A,B2],{idle:B2}); log('game1 over:',ok,'timeout notes:',B2.notes.filter(n=>/ran out/.test(n)).length,'timer msgs:',A.timers);
  log('ledger:',JSON.stringify(A.last.s.ledger), 'winners', A.last.s.winners);
  // play again votes
  A.send({t:'again'}); await sleep(100); log('after one vote phase:',A.last.s.phase, A.last.meta.players.map(p=>p.again));
  B2.send({t:'again'}); await sleep(200); log('both voted phase:',A.last.s.phase,'games',A.last.s.games, A.last.ev&&A.last.ev.again);
  // disconnect Bex mid game
  await sleep(500); B2.ws.close(); await sleep(300); log('after drop:',A.notes.slice(-1)[0], 'away:',A.last.s.players.map(p=>p.away));
  await sleep(2000);
  const B3=client('Bex','uB',code,''); await B3.open(); await sleep(300); log('reconnected away:',A.last.s.players.map(p=>p.away), A.notes.slice(-1)[0]);
  ok=await play([A,B3]); log('game2 over:',ok,'games',A.last.s.games);
  const me=(await (await fetch(B+'/api/me',{headers:{authorization:'Bearer dev-ua'}})).json()).rec; log('Ace history:',me.history.length,'games in session:',me.history[0].games,'v:',JSON.stringify(me.v).slice(0,80));
  log('Ace unlocks seen:',A.unlocks.length);
  B3.send({t:'leave'}); await sleep(300); log('ended:',A.ended);
  process.exit(0);
})();
