import sys,time
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':360,'height':780},reduced_motion='reduce')
    ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-ace',rt:'',exp:9e9}))")
    A=ctx.new_page(); A.on('pageerror',lambda e: errs.append(str(e)))
    A.goto('http://localhost:8795'); A.click('#mSettings'); A.click('#tg80'); A.click('#tm0'); A.screenshot(path=O+'/p1-settings.png',full_page=True)
    A.click('#backSettings'); print('menu rules:',A.inner_text('#menuRules'))
    A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.wait_for_timeout(200)
    print('host picks:',A.is_checked('#ht80'),A.is_checked('#hm0')); A.screenshot(path=O+'/p2-host.png',full_page=True)
    A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])'); print('room:',A.inner_text('#rInfo'))
    A.click('#rStart'); A.wait_for_selector('#play:not([hidden])'); t0=time.time(); clock=False
    while time.time()-t0<200 and A.get_attribute('#app','data-phase')!='over':
        if A.is_visible('#clock'): clock=True
        if not A.is_disabled('#rollBtn') and '(you)' in A.inner_text('#who'):
            rb=A.inner_text('#rollBtn'); risk=int(A.inner_text('#v2') or 0)
            if rb.startswith('Pass'): A.click('#rollBtn')
            elif risk>=15 and not A.is_disabled('#lockBtn'): A.click('#lockBtn')
            else: A.click('#rollBtn')
        A.wait_for_timeout(100)
    print('over:',A.get_attribute('#app','data-phase'),'| clock ever shown:',clock,'|',A.inner_text('#winSub'))
    b.close()
print('errors',errs)
