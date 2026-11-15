import sys
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]; BASE='http://localhost:8849'
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}));localStorage.setItem('degenpig-tut','1')"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex')
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.click('#hLess'); A.click('#hLess'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    B.goto(BASE); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#play:not([hidden])')
    A.wait_for_selector('#play:not([hidden])');A.wait_for_timeout(800)
    meA=A.evaluate('__dp.S.me');meB=B.evaluate('__dp.S.me')
    print('me',meA,meB,'chip on own tile only:',B.evaluate("[...document.querySelectorAll('#board .tile')].map(t=>t.dataset.i+':'+!!t.querySelector('.emochip'))"))
    B.click('#board .tile[data-i="%d"]'%meA);B.wait_for_timeout(300);print('wheel opened on other tile:',B.is_visible('#emoWheel'))
    B.click('#board .tile[data-i="%d"]'%meB);B.wait_for_timeout(400);B.click('#emoWheel .emobtn[data-e=cocky]')
    A.wait_for_timeout(900);print('A sees:',A.evaluate("[...document.querySelectorAll('#emoLayer .emote')].map(e=>e.className)"),'B sees:',B.evaluate("[...document.querySelectorAll('#emoLayer .emote')].map(e=>e.className)"))
    A.screenshot(path=O+'/online-A.png')
    B.click('#board .tile[data-i="%d"]'%meB);B.wait_for_timeout(300);B.click('#emoWheel .emobtn[data-e=sad]');A.wait_for_timeout(300)
    print('spam blocked (still amazed):',A.evaluate("[...document.querySelectorAll('#emoLayer .emote')].map(e=>e.className)"))
    A.wait_for_timeout(3200);print('gone after 3s:',A.evaluate("document.querySelectorAll('#emoLayer .emote').length"))
    b.close()
print('errors',errs)
