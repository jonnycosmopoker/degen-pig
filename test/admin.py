import sys,time
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag,w=390,h=844):
        ctx=b.new_context(viewport={'width':w,'height':h},reduced_motion='reduce')
        ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex')
    A.goto('http://localhost:8796'); A.click('#mOnline'); A.fill('#onName','Ace'); A.wait_for_timeout(500)
    print('owner link for Ace:',A.is_visible('#ownerLink'))
    A.click('#hostBtn'); A.click('#hm0'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto('http://localhost:8796'); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(700)
    print('owner link for Bex:',B.is_visible('#ownerLink'))
    B.click('#lobbyList button[data-code]'); B.wait_for_selector('#room:not([hidden])')
    A.click('#rStart'); A.wait_for_selector('#play:not([hidden])')
    t0=time.time()
    while time.time()-t0<200 and A.get_attribute('#app','data-phase')!='over':
        for pg in (A,B):
            if pg.get_attribute('#app','data-phase') in('play','final') and not pg.is_disabled('#rollBtn') and '(you)' in pg.inner_text('#who'):
                rb=pg.inner_text('#rollBtn'); risk=int(pg.inner_text('#v2') or 0)
                if rb.startswith('Pass'): pg.click('#rollBtn')
                elif risk>=15 and not pg.is_disabled('#lockBtn'): pg.click('#lockBtn')
                else: pg.click('#rollBtn')
        A.wait_for_timeout(100)
    print('game over:',A.get_attribute('#app','data-phase'))
    S=phone('ace',1100,1400); S.goto('http://localhost:8796/admin'); S.wait_for_timeout(1200)
    print('admin tiles:',S.inner_text('.tiles').replace('\n',' '))
    print('tables:',S.inner_text('#tablesWrap').replace('\n',' | ')[:200])
    print('top:',S.inner_text('#topWrap').replace('\n',' | ')[:300])
    S.hover('#cGames .hit[data-i="29"]'); S.wait_for_timeout(200); print('tip:',S.inner_text('#cGames .tip'))
    S.screenshot(path=O+'/a1-admin.png',full_page=True)
    M=phone('ace',390,844); M.goto('http://localhost:8796/admin.html'); M.wait_for_timeout(1000); M.screenshot(path=O+'/a2-admin-phone.png',full_page=True)
    X=phone('bex'); X.goto('http://localhost:8796/admin.html'); X.wait_for_timeout(800); print('Bex sees:',X.inner_text('#gate'))
    N=b.new_page(); N.goto('http://localhost:8796/admin.html'); N.wait_for_timeout(500); print('signed out sees:',N.inner_text('#gate').replace('\n',' '))
    b.close()
print('errors',errs)
