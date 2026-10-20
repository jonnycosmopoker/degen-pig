import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844}); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        return ctx.new_page()
    A=phone('ace'); A.goto('http://localhost:8799'); A.click('#mOnline'); A.fill('#onName','Ace'); A.wait_for_timeout(800); print('A alone:',A.inner_text('#lobbyCount'))
    A.screenshot(path=sys.argv[1]+'/lc1.png')
    B=phone('bex'); B.goto('http://localhost:8799'); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(4500); print('A sees after Bex:',A.inner_text('#lobbyCount'))
    A.click('#hostBtn'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])'); B.wait_for_timeout(4500); print('B sees, Ace hosting:',B.inner_text('#lobbyCount'))
    B.click('#lobbyList button[data-code]'); B.wait_for_selector('#room:not([hidden])'); A.click('#rStart'); A.wait_for_timeout(500)
    C=phone('cy'); C.goto('http://localhost:8799'); C.click('#mOnline'); C.fill('#onName','Cy'); C.wait_for_timeout(1200); print('Cy sees, game running:',C.inner_text('#lobbyCount'))
    b.close()
