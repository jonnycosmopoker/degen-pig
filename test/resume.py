import sys,time,urllib.request
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]; BASE='http://localhost:8802'
def restart(): print('  restart:',urllib.request.urlopen(BASE+'/dev/restart').read().decode())
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce'); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex')
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.click('#hm30'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto(BASE); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#room:not([hidden])')
    A.click('#rStart'); A.wait_for_selector('#play:not([hidden])')
    def play(secs,stopAt=None):
        t0=time.time()
        while time.time()-t0<secs:
            if A.get_attribute('#app','data-phase')=='over': return 'over'
            for pg in (A,B):
                if pg.get_attribute('#app','data-phase') in('play','final') and not pg.is_disabled('#rollBtn') and '(you)' in pg.inner_text('#who'):
                    rb=pg.inner_text('#rollBtn'); risk=int(pg.inner_text('#v2') or 0)
                    if rb.startswith('Pass'): pg.click('#rollBtn')
                    elif risk>=15 and not pg.is_disabled('#lockBtn'): pg.click('#lockBtn')
                    else: pg.click('#rollBtn')
            A.wait_for_timeout(120)
    play(12)
    before=A.inner_text('#board').replace('\n',' '); print('before restart:',before,'| who:',A.inner_text('#who'))
    restart(); A.wait_for_timeout(300); print('  during:',A.inner_text('#netNote') if A.is_visible('#netNote') else None)
    A.wait_for_timeout(4000); print('after restart:',A.inner_text('#board').replace('\n',' '),'| who:',A.inner_text('#who'),'| phase:',A.get_attribute('#app','data-phase'),B.get_attribute('#app','data-phase'))
    r=play(240); print('finished game:',r,A.inner_text('#winLine') if r=='over' else '')
    A.click('#againBtn'); B.click('#againBtn'); A.wait_for_timeout(800)
    # restart while Bex is gone: Bex should get a computer after the grace period
    B.close(); restart(); A.wait_for_timeout(4000); print('Ace back after 2nd restart:',A.get_attribute('#app','data-phase'))
    lob=urllib.request.urlopen(BASE+'/api/lobby').read().decode(); print('lobby after restarts:',lob[:200])
    b.close()
print('errors',errs)
