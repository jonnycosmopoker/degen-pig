import sys, os, time, re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8791'; OUT=sys.argv[1]
errs=[]
def shot(pg,name): pg.screenshot(path=os.path.join(OUT,name+'.png'))
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce')
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); pg.on('console',lambda m: errs.append(tag+' console: '+m.text) if m.type=='error' else None)
        return ctx,pg
    cA,A=phone('Ace'); cB,B=phone('Bex'); cC,C=phone('Cy')
    # Ace hosts a private table
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.wait_for_timeout(300); shot(A,'o1-lobby-empty')
    A.click('#hostBtn'); A.fill('#hName','Monday Pigs'); A.click('#hPriv'); A.fill('#hPw','oink'); shot(A,'o2-host')
    A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])'); A.wait_for_timeout(200)
    code=A.inner_text('#rCode'); print('code',code); shot(A,'o3-room-host')
    # Bex finds it in the lobby
    B.goto(BASE); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); shot(B,'o4-lobby')
    print('lobby row:',B.inner_text('#lobbyList').replace('\n',' | '))
    B.click('#lobbyList button[data-code]'); B.fill('#pwIn','wrong'); B.click('#pwGo'); B.wait_for_timeout(500)
    print('wrong pw dialog:',B.is_visible('#pwDlg'), B.inner_text('#pwText'))
    B.fill('#pwIn','oink'); B.click('#pwGo'); B.wait_for_selector('#room:not([hidden])'); B.wait_for_timeout(200)
    # Cy uses the invite link
    C.goto(BASE+'/?t='+code+'&p=oink'); C.wait_for_timeout(300); print('Cy msg:',C.inner_text('#onMsg'))
    C.fill('#onName','Cy'); C.click('#joinBtn'); C.wait_for_selector('#room:not([hidden])'); C.wait_for_timeout(300)
    shot(C,'o5-room-guest'); print('seats:',A.inner_text('#rSeats').replace('\n',' | '),'| start:',A.inner_text('#rStart'))
    A.click('#rStart'); 
    for pg in (A,B,C): pg.wait_for_selector('#play:not([hidden])',timeout=5000)
    A.wait_for_timeout(300); shot(A,'o6-play-A'); shot(B,'o6-play-B')
    # play: each phone rolls on its own turn until 12+, then locks. Cy idles on its first turn to hit the timer.
    pages={'A':A,'B':B,'C':C}; cyIdle=True; seenClock=False; timeouts=0; t0=time.time()
    while time.time()-t0<240:
        if all(pg.get_attribute('#app','data-phase')=='over' for pg in pages.values()): break
        for k,pg in pages.items():
            if pg.get_attribute('#app','data-phase') not in ('play','final'): continue
            if pg.is_disabled('#rollBtn') : continue
            who=pg.inner_text('#who')
            if '(you)' not in who: continue
            if k=='C' and cyIdle:
                if pg.is_visible('#clock'): seenClock=True; shot(pg,'o7-clock')
                continue
            rb=pg.inner_text('#rollBtn'); risk=int(pg.inner_text('#v2') or 0)
            if rb.startswith('Pass') : pg.click('#rollBtn'); continue
            if risk>=12 and not pg.is_disabled('#lockBtn'): pg.click('#lockBtn')
            else: pg.click('#rollBtn')
        if cyIdle and 'ran out of time' in (A.inner_text('#netNote') if A.is_visible('#netNote') else ''):
            cyIdle=False; timeouts+=1
        A.wait_for_timeout(120)
    print('game over:',A.get_attribute('#app','data-phase'),'| clock seen:',seenClock,'| timeouts seen:',timeouts)
    print('A win line:',A.inner_text('#winLine'),'|',A.inner_text('#winSub'))
    shot(A,'o8-over'); A.click('#statsBtn'); A.wait_for_timeout(300); shot(A,'o9-stats'); A.click('#statsBtn')
    A.click('#againBtn'); A.wait_for_timeout(300); print('after Ace votes, B still over:',B.get_attribute('#app','data-phase'), '| A again btn:',A.inner_text('#againBtn'))
    B.click('#againBtn'); C.click('#againBtn'); A.wait_for_timeout(800)
    print('new game phase:',A.get_attribute('#app','data-phase'), A.inner_text('#callout') if A.is_visible('#callout') else '')
    # Cy's phone drops and comes back by reloading
    C.close(); A.wait_for_timeout(800)
    print('after Cy drop note:',A.inner_text('#netNote') if A.is_visible('#netNote') else None)
    C=cC.new_page(); C.on('pageerror',lambda e: errs.append('Cy2: '+str(e))); C.goto(BASE); C.wait_for_timeout(1500)
    print('Cy back in phase:',C.get_attribute('#app','data-phase'), '| A note:',A.inner_text('#netNote') if A.is_visible('#netNote') else None)
    shot(C,'o10-cy-back')
    # Bex leaves: table ends for everyone
    B.click('#rulesBtn'); B.click('#quitBtn'); B.wait_for_timeout(200); print('leave dialog:',B.inner_text('#leaveText')); B.click('#leaveBtn'); A.wait_for_timeout(800)
    print('A end dialog:',A.is_visible('#endDlg'),A.inner_text('#endText')); shot(A,'o11-ended')
    A.click('#endOk'); A.click('#backOnline'); A.click('#mAch'); A.wait_for_timeout(800); print('ach:',A.inner_text('#achSum')); shot(A,'o12-ach')
    A.click('#backAch'); A.click('#mOnline'); A.wait_for_timeout(800); print('history:',A.inner_text('#histList').replace('\n',' | ')); shot(A,'o13-history')
    b.close()
print('errors',errs[:10])
