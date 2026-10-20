import sys,time,json,urllib.request
from playwright.sync_api import sync_playwright
errs=[]; BASE='http://localhost:8805'
def me(tag): return json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/api/me',headers={'authorization':'Bearer dev-'+tag})).read())['rec']['v']
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce'); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex'); C=phone('cy')
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.click('#hLess'); A.click('#hLess'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto(BASE); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#play:not([hidden])')
    C.goto(BASE); C.click('#mOnline'); C.fill('#onName','Cy'); C.wait_for_timeout(1200); C.click('#liveList button[data-watch]'); C.wait_for_selector('#play:not([hidden])')
    toast=None
    for g in range(3):
        t0=time.time()
        while time.time()-t0<240 and A.get_attribute('#app','data-phase')!='over':
            for pg in (A,B):
                if pg.get_attribute('#app','data-phase') in('play','final') and not pg.is_disabled('#rollBtn') and '(you)' in pg.inner_text('#who'):
                    rb=pg.inner_text('#rollBtn'); risk=int(pg.inner_text('#v2') or 0)
                    if rb.startswith('Pass'): pg.click('#rollBtn')
                    elif risk>=20 and not pg.is_disabled('#lockBtn'): pg.click('#lockBtn')
                    else: pg.click('#rollBtn')
            A.wait_for_timeout(100)
        C.wait_for_timeout(600)
        if g==0: toast=C.inner_text('#achToast') if C.is_visible('#achToast') else None
        print('game',g+1,'winner:',A.inner_text('#winLine'))
        if g<2: A.click('#againBtn'); B.click('#againBtn'); A.wait_for_timeout(800)
    print('Cy toast after game 1:',toast)
    for t in ('ace','bex','cy'):
        v=me(t); print(t,{k:v.get(k) for k in ('marathon','social','headsup','railbird','clockwork','nightowl') if k in v})
    b.close()
print('errors',errs)
