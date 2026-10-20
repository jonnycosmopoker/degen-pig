import sys,time
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce'); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex'); C=phone('cy')
    A.goto('http://localhost:8800'); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.fill('#hName','Friday Pigs'); A.click('#hm0'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto('http://localhost:8800'); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#room:not([hidden])')
    A.click('#rStart'); A.wait_for_selector('#play:not([hidden])')
    C.goto('http://localhost:8800'); C.click('#mOnline'); C.fill('#onName','Cy'); C.wait_for_timeout(900)
    print('Cy lobby live:',C.inner_text('#liveList').replace('\n',' | ')); C.screenshot(path=O+'/w1-lobby.png')
    C.click('#liveList button[data-watch]'); C.wait_for_selector('#play:not([hidden])'); C.wait_for_timeout(500)
    print('Cy controls hidden:',not C.is_visible('#rollBtn'),not C.is_visible('#lockBtn'),'| bar:',C.inner_text('#watchBar').replace('\n',' '))
    A.wait_for_timeout(300); print('Ace sees:',A.inner_text('#watchN') if A.is_visible('#watchN') else None)
    t0=time.time(); shot=False
    while time.time()-t0<200 and A.get_attribute('#app','data-phase')!='over':
        for pg in (A,B):
            if pg.get_attribute('#app','data-phase') in('play','final') and not pg.is_disabled('#rollBtn') and '(you)' in pg.inner_text('#who'):
                rb=pg.inner_text('#rollBtn'); risk=int(pg.inner_text('#v2') or 0)
                if rb.startswith('Pass'): pg.click('#rollBtn')
                elif risk>=15 and not pg.is_disabled('#lockBtn'): pg.click('#lockBtn')
                else: pg.click('#rollBtn')
        if not shot and time.time()-t0>6: C.screenshot(path=O+'/w2-watching.png'); shot=True
        A.wait_for_timeout(100)
    C.wait_for_timeout(1500); print('Cy phase at end:',C.get_attribute('#app','data-phase'),'| again hidden:',not C.is_visible('#againBtn'),'| new btn:',C.inner_text('#newBtn'))
    C.click('#newBtn'); C.wait_for_timeout(500); print('Cy back:',C.get_attribute('#app','data-phase'))
    A.click('#againBtn'); B.click('#againBtn'); A.wait_for_timeout(800); print('Ace watchers after Cy left:',A.is_visible('#watchN'))
    b.close()
print('errors',errs)
