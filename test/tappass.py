from playwright.sync_api import sync_playwright
errs=[]; BASE='http://localhost:8849'
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844}); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}));localStorage.setItem('degenpig-tut','1')"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex')
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.click('#hLess'); A.click('#hLess'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto(BASE); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#play:not([hidden])')
    A.wait_for_selector('#play:not([hidden])')
    pages={0:A,1:B}; done=False
    for step in range(200):
        pg=A if A.evaluate('__dp.S.phase')!='' else A
        act=A.evaluate("(()=>{const S=__dp.S;return S.phase==='order'?-2:(S.cur??-1)})()")
        for pg in (A,B):
            st=pg.evaluate("(()=>{const S=__dp.S;return {me:S.me,busy:S.busy,bust:!!S.bust,phase:S.phase,rolling:S.rolling}})()")
            if st['busy'] or st['rolling']:continue
            mine=pg.evaluate("(()=>{const S=__dp.S;try{return !document.getElementById('rollBtn').disabled&&document.getElementById('rollBtn').offsetParent!==null}catch(e){return false}})()")
            if st['bust'] and pg.evaluate("__dp.S.cur===__dp.S.me"):
                before=pg.evaluate("__dp.S.cur");label=pg.inner_text('#rollBtn')
                pg.click('#tray',position={'x':150,'y':200});pg.wait_for_timeout(1500)
                after=pg.evaluate("__dp.S.cur");print('bust; button said:',label,'| tapped table -> turn',before,'->',after,'bust now',pg.evaluate('!!__dp.S.bust'));done=True;break
        if done:break
        for pg in (A,B):
            try:
                if pg.evaluate("__dp.S.cur===__dp.S.me||__dp.S.phase==='order'") and not pg.is_disabled('#rollBtn'):pg.click('#rollBtn',timeout=2000)
            except Exception:pass
        A.wait_for_timeout(700)
    print('found bust:',done)
    b.close()
print('errors',errs)
