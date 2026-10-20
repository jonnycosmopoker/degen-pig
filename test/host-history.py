import sys, time
from playwright.sync_api import sync_playwright
BASE='http://localhost:8793'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce'); A=ctx.new_page()
    A.on('pageerror',lambda e: errs.append(str(e)))
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn')
    A.click('#ht150'); A.click('#hm15'); A.click('#hOpts .tog[data-k="power"]'); A.click('#hOpts .tog[data-k="golden"]')
    A.screenshot(path=sys.argv[1]+'/h1-host.png',full_page=True)
    print('host toggles:',[t.get_attribute('aria-checked') for t in A.query_selector_all('#hOpts .tog')])
    A.fill('#hName','Solo Test'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])'); print('room rules:',A.inner_text('#rInfo'))
    A.click('#rStart'); A.wait_for_selector('#play:not([hidden])')
    print('tiles have power dots:',len(A.query_selector_all('#board .pw'))>0)
    games=0; t0=time.time()
    while time.time()-t0<300 and games<2:
        ph=A.get_attribute('#app','data-phase')
        if ph=='over':
            games+=1
            if games<2: A.click('#againBtn'); A.wait_for_timeout(500)
            continue
        if ph in('play','final') and not A.is_disabled('#rollBtn') and '(you)' in A.inner_text('#who'):
            rb=A.inner_text('#rollBtn'); risk=int(A.inner_text('#v2') or 0)
            if rb.startswith('Pass'): A.click('#rollBtn')
            elif risk>=15 and not A.is_disabled('#lockBtn'): A.click('#lockBtn')
            else: A.click('#rollBtn')
        A.wait_for_timeout(100)
    print('games played:',games, '| scoreboard:',A.inner_text('#standings').replace('\n',' '))
    A.click('#newBtn'); A.click('#leaveBtn'); A.wait_for_timeout(1200)
    print('history head:',A.inner_text('#histHead'))
    A.click('#histList summary'); A.wait_for_timeout(200)
    print('history:',A.inner_text('#histList').replace('\n',' | '))
    A.screenshot(path=sys.argv[1]+'/h2-history.png',full_page=True)
    b.close()
print('errors',errs)
