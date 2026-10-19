from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce').new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8792'); pg.click('#mPass'); pg.click('#less')
    for i in range(3):
        for _ in range(i%3+1): pg.click('#kind%d'%i)
    pg.click('#startBtn')
    for t in range(3000):
        if pg.get_attribute('#app','data-phase')=='over': break
        pg.wait_for_timeout(100)
    print('over:',pg.inner_text('#winLine'),'| stats hidden:',not pg.is_visible('.chartcard'))
    pg.click('#statsBtn'); print('stats shown:',pg.is_visible('.chartcard'),pg.inner_text('#statsBtn'))
    pg.click('#againBtn'); pg.wait_for_timeout(300); print('again ->',pg.get_attribute('#app','data-phase'))
    b.close()
print('errors',errs)
