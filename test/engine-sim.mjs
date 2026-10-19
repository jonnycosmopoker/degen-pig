import { Engine, DEF_RULES } from '../shared/engine.js';
let games=0, wins={}, turns=0, errs=0;
for (const rules of [DEF_RULES, {...DEF_RULES,reroll:true,verify:true,power:true,golden:true,target:150}]) {
  for (let t=0;t<300;t++){
    const S={rules:{...rules},players:['c','b','g','b'].map((s,i)=>({name:'P'+i,bot:s,uid:null,acc:i===1?{v:{}}:null})),online:true};
    const E=Engine(S); E.newSession();
    for(let g=0;g<3;g++){
      let guard=0;
      while(S.phase!=='over'){ E.botMove(); if(++guard>5000){errs++;break} }
      games++; turns+=S.players.reduce((a,p)=>a+p.g.turns,0); S.winners.forEach(w=>wins[S.players[w].bot]=(wins[S.players[w].bot]||0)+1);
      if(g<2)E.beginOrder();
    }
    if(S.ledger.length!==3||S.records.length!==3)errs++;
  }
}
console.log({games,errs,avgTurns:(turns/games).toFixed(1),wins});
