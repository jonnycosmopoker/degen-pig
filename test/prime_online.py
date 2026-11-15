from playwright.sync_api import sync_playwright
errs=[]; BASE='http://localhost:8849'
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844}); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-ace',rt:'',exp:9e9}));localStorage.setItem('degenpig-tut','1')")
    A=ctx.new_page(); A.on('pageerror',lambda e: errs.append(str(e)))
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.click('#hOpts .tog[data-k=power]')
    A.click('#hOpts .tog[data-k=prime]'); print('host prime/power:',A.evaluate("[...document.querySelectorAll('#hOpts .tog')].filter(t=>['prime','power'].includes(t.dataset.k)).map(t=>t.dataset.k+'='+t.getAttribute('aria-checked'))"))
    A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])'); A.click('#rStart'); A.wait_for_selector('#play:not([hidden])')
    A.evaluate("window.__pr=[];const o=window.primeFx")
    seen=False
    for k in range(240):
        st=A.evaluate("({ph:__dp.S.phase,pr:JSON.stringify(__dp.S.primes||{}),me:__dp.S.me,cur:__dp.S.cur,rules:__dp.S.rules&&__dp.S.rules.prime,strip:!document.getElementById('primes').hidden})")
        if st['pr']!='{}' and not seen: print('first claim seen:',st);seen=True;A.wait_for_timeout(300);A.screenshot(path='/tmp/claude-0/-home-claude/f3a73d25-10aa-5d56-8694-e7d916454734/scratchpad/prime/online.png');break
        if st['cur']==st['me'] and st['ph'] in ('play','final'):
            try:
                if A.is_enabled('#lockBtn') and A.evaluate('__dp.S.turn')>=12: A.click('#lockBtn',timeout=1500)
                elif A.is_enabled('#rollBtn'): A.click('#rollBtn',timeout=1500)
            except Exception: pass
        A.wait_for_timeout(500)
    print('strip shown:',A.is_visible('#primes'),'claimed:',A.evaluate('JSON.stringify(__dp.S.primes)'))
    b.close()
print('errors',errs)
