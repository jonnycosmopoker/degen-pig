/* Enable Triples: a turn with two or more ×2 reasons is ×3, and only when the rule is on */
import { Engine, DEF_RULES } from '../shared/engine.js';
function run(extra, games) {
  let x3turns = 0, x3rolls = 0, bad = 0, x2turns = 0, lastTurnId = -1;
  for (let t = 0; t < games; t++) {
    const S = { rules: { ...DEF_RULES, power: true, ...extra }, players: ['b', 'b', 'g', 'c'].map((s, i) => ({ name: 'P' + i, bot: s, uid: null, acc: null })), online: true };
    const E = Engine(S); E.newSession(); let guard = 0;
    while (S.phase !== 'over' && ++guard < 6000) {
      if ((S.phase === 'play' || S.phase === 'final') && S.turnId !== lastTurnId) {
        lastTurnId = S.turnId; const i = S.cur, p = S.players[i];
        const lead = Math.max(...S.players.map((q, j) => j === i ? -1 : q.score));
        let why = S.powerTurn ? 1 : 0;
        if (!S.rules.noDbl) { if (p.st && p.st.sn >= 2) why++; if ((p.score === 0 && lead > 75) || (S.phase === 'final' && lead - p.score > 75)) why++ }
        const want = why === 0 ? 1 : (S.rules.triple && why >= 2 ? 3 : 2);
        if ((S.hotX || 1) !== want) bad++;
        if (S.hotX === 3) x3turns++; else if (S.hotX === 2) x2turns++;
      }
      const r = E.botMove();
      if (r && r.kind === 'roll' && S.rolls.length) { const last = S.rolls[S.rolls.length - 1]; if (!last.bust && last.m !== (S.hotX || 1)) bad++; if (!last.bust && last.m === 3) { x3rolls++; const dbl = last.a === last.b; if (last.pts !== (last.a + last.b) * (dbl ? 2 : 1) * 3) bad++ } }
    }
    if (guard >= 6000) bad++;
  }
  return { x2turns, x3turns, x3rolls, bad };
}
console.log('Triples on :', run({ triple: true }, 3000));
console.log('Triples off:', run({ triple: false }, 1500));
console.log('Triples on, Disable Doubles on:', run({ triple: true, noDbl: true }, 1000));
