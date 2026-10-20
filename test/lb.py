import sys,time
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce'); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex')
    A.goto('http://localhost:8804'); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#lbBtn'); A.wait_for_timeout(500); print('empty board:',A.inner_text('#lbBody')[:80].replace('\n',' | ')); A.click('#backLb')
    A.click('#hostBtn'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto('http://localhost:8804'); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#room:not([hidden])')
    A.click('#rStart'); A.wait_for_selector('#play:not([hidden])'); t0=time.time()
    while time.time()-t0<240 and A.get_attribute('#app','data-phase')!='over':
        for pg in (A,B):
            if pg.get_attribute('#app','data-phase') in('play','final') and not pg.is_disabled('#rollBtn') and '(you)' in pg.inner_text('#who'):
                rb=pg.inner_text('#rollBtn'); risk=int(pg.inner_text('#v2') or 0)
                if rb.startswith('Pass'): pg.click('#rollBtn')
                elif risk>=15 and not pg.is_disabled('#lockBtn'): pg.click('#lockBtn')
                else: pg.click('#rollBtn')
        A.wait_for_timeout(100)
    print('over:',A.inner_text('#winLine'))
    A.click('#newBtn'); A.click('#leaveBtn'); A.wait_for_timeout(500); A.click('#lbBtn'); A.wait_for_timeout(700)
    print('week:',A.inner_text('#lbBody').replace('\n',' | ')); A.screenshot(path=O+'/lb1.png',full_page=True)
    A.click('#lb .tab[data-p="all"]'); A.wait_for_timeout(500); print('all since:',A.inner_text('#lbSince'))
    b.close()
print('errors',errs)
