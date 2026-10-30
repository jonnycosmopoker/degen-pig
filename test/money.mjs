/* Track $: CosMo's worked example. Target 100, Golden Points on, $50 a game, $1 a point, $3 a golden point. */
import { Engine, DEF_RULES } from '../shared/engine.js';
function run(scores, money, golden = true) {
  const S = { rules: { ...DEF_RULES, golden, money }, players: scores.map((_, i) => ({ name: 'ABCDEF'[i], bot: 'b', uid: null, acc: null })), online: true };
  const E = Engine(S); E.newSession();
  S.players.forEach((p, i) => p.score = scores[i]);
  const r = E.settle(E.leaders()); const $ = c => (c >= 0 ? '+$' : '-$') + (Math.abs(c) / 100).toFixed(2).replace(/\.00$/, '');
  return S.players.map((p, i) => p.name + ' ' + $(r.net[i]) + ' (game ' + $(r.parts[i][0]) + ', points ' + $(r.parts[i][1]) + ', golden ' + $(r.parts[i][2]) + ')');
}
console.log('Example:'); run([140, 0, 75, 108], { game: 50, point: 1, golden: 3 }).forEach(l => console.log('  ' + l));
console.log('Tie for the win at 120:'); run([120, 120, 40], { game: 10, point: 0.5, golden: 1 }).forEach(l => console.log('  ' + l));
console.log('Golden Points off (points use full scores):'); run([130, 60], { game: 5, point: 1, golden: 3 }, false).forEach(l => console.log('  ' + l));
