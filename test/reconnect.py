import time
from playwright.sync_api import sync_playwright
errs=[];BASE='http://localhost:8822'
with sync_playwright() as p:
    b=p.chromium.launch()
    def ctx(tag):
        c=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');c.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag);return c
    def page(c,tag):
        pg=c.new_page();pg.on('pageerror',lambda e:errs.append(tag+': '+str(e)));return pg
    ca=ctx('ace');cb=ctx('bex');A=page(ca,'ace');B=page(cb,'bex')
    A.goto(BASE);A.click('#mOnline');A.fill('#onName','Ace');A.click('#hostBtn');A.click('#hLess');A.click('#hLess');A.click('#hCreate');A.wait_for_selector('#room:not([hidden])')
    B.goto(BASE);B.click('#mOnline');B.fill('#onName','Bex');B.wait_for_timeout(600);B.click('#lobbyList button[data-code]');B.wait_for_selector('#play:not([hidden])');A.wait_for_selector('#play:not([hidden])')
    def cur(): return A.evaluate('__dp.S.players[__dp.S.cur].name')
    def wait_turn(name,pgs):
        for _ in range(300):
            if A.evaluate("__dp.S.phase")=='play' and cur()==name and not A.evaluate('__dp.S.busy') and not A.evaluate('__dp.S.bust'): return True
            for pg in pgs:
                try:
                    if pg.get_attribute('#app','data-phase') in('play','final') and not pg.is_disabled('#rollBtn') and '(you)' in pg.inner_text('#who'):
                        t=pg.inner_text('#rollBtn')
                        if t.startswith('Pass') or t.startswith('Roll') and cur()!=name: pg.click('#rollBtn')
                        elif not pg.is_disabled('#lockBtn') and cur()!=name: pg.click('#lockBtn')
                except Exception: pass
            A.wait_for_timeout(150)
        return False
    # 1) Bex drops on Ace's turn: Ace keeps playing, Bex is covered after 30s (scaled)
    print('Ace turn:',wait_turn('Ace',[A,B]))
    B.close();A.wait_for_timeout(700)
    print('note to Ace:',A.inner_text('#netNote'))
    n0=A.evaluate('__dp.S.rolls.length');A.click('#rollBtn');A.wait_for_timeout(1500);print('Ace can still roll:',A.evaluate('__dp.S.rolls.length')>n0 or A.evaluate('__dp.S.bust'))
    A.wait_for_timeout(int(30000*0.3)+1500)
    print('after grace, Bex away (CPU):',A.evaluate("__dp.S.players.find(p=>p.name==='Bex').away"),'| note:',A.inner_text('#netNote'))
    # Bex comes back
    B=page(cb,'bex');B.goto(BASE);B.wait_for_timeout(2500);print('Bex back, away:',A.evaluate("__dp.S.players.find(p=>p.name==='Bex').away"),'| Bex phase',B.get_attribute('#app','data-phase'))
    # 2) Bex drops on Bex's turn: game pauses (no computer moves), clock counts down; Bex returns and plays
    print('Bex turn:',wait_turn('Bex',[A]))
    B.close();A.wait_for_timeout(1500)
    r0=A.evaluate('__dp.S.rolls.length');print('note:',A.inner_text('#netNote'),'| chip:',A.inner_text('#who'),'| clock:',A.inner_text('#clock') if A.is_visible('#clock') else None)
    A.wait_for_timeout(4000);print('paused, no moves while waiting:',A.evaluate('__dp.S.rolls.length')==r0,'| still Bex turn:',cur()=='Bex','| clock:',A.inner_text('#clock') if A.is_visible('#clock') else None)
    B=page(cb,'bex');B.goto(BASE);B.wait_for_timeout(2500)
    print('Bex back on own turn: rc',A.evaluate("__dp.S.players.find(p=>p.name==='Bex').rc"),'| Bex can roll:',not B.is_disabled('#rollBtn'),'| who:',B.inner_text('#who'))
    # 3) Bex drops on own turn and does not return: computer takes over after the grace
    B.close();A.wait_for_timeout(int(30000*0.3)+4000)
    print('no return: Bex away',A.evaluate("__dp.S.players.find(p=>p.name==='Bex').away"),'| game moved on:',A.evaluate('__dp.S.rolls.length')>0 or cur()=='Ace')
    b.close()
print('errors',errs)
