import sys,time
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-ace',rt:'',exp:9e9}))")
    A=ctx.new_page(); A.on('pageerror',lambda e: errs.append(str(e)))
    A.goto('http://localhost:8801'); A.click('#mSettings'); print('settings timer row gone:',A.query_selector('#tm0') is None); A.click('#backSettings')
    A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn')
    print('defaults:',{k:A.get_attribute('#hOpts .tog[data-k="%s"]'%k,'aria-checked') for k in ['golden','power','reroll']},'no timer:',A.is_checked('#hm0'),'| note:',A.inner_text('#hRules'))
    A.click('#hm15'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])'); A.click('#rStart'); A.wait_for_selector('#play:not([hidden])')
    trays=set(); docks=set(); t0=time.time(); shot=False; clockSeen=False
    while time.time()-t0<40:
        th=round(A.eval_on_selector('#tray','e=>e.getBoundingClientRect().height'))
        if th not in trays: print('tray',th,A.evaluate("()=>['who','stats','rolls','note','watchBar'].map(i=>i+':'+document.getElementById(i).offsetHeight+':'+document.getElementById(i).innerText.slice(0,80).replace(/\\n/g,' '))"))
        trays.add(th); docks.add(round(A.eval_on_selector('#play','e=>e.getBoundingClientRect().top')))
        if A.is_visible('#clock'):
            clockSeen=True
            if not shot and 'You' in A.inner_text('#clock'): A.screenshot(path=O+'/t1-clock.png'); shot=True
        if not A.is_disabled('#rollBtn') and '(you)' in A.inner_text('#who'):
            rb=A.inner_text('#rollBtn'); risk=int(A.inner_text('#v2') or 0)
            if rb.startswith('Pass'): A.click('#rollBtn')
            elif risk>=15 and not A.is_disabled('#lockBtn'): A.click('#lockBtn')
            else: A.click('#rollBtn')
        A.wait_for_timeout(150)
    print('clock seen:',clockSeen,'| tray heights:',trays,'| panel tops:',docks)
    A.click('#rulesBtn'); A.click('#quitBtn'); A.click('#leaveBtn'); A.wait_for_timeout(500); A.click('#hostBtn')
    print('remembered timer 15:',A.is_checked('#hm15'))
    b.close()
print('errors',errs)
