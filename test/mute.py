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
    A.click('#board .tile[data-i="%d"]'%meB);A.wait_for_timeout(400);A.screenshot(path=O+'/mute-menu.png');print('menu:',A.inner_text('#emoMenu .mucard').replace('\n',' | '))
    A.click('#emoMenu .mubtn');A.wait_for_timeout(300);print('muted badge on Bex tag:',A.is_visible('#board .tile[data-i="%d"] .emochip.mut'%meB))
    B.click('#board .tile[data-i="%d"]'%meB);B.wait_for_timeout(400);B.click('#emoWheel .emobtn[data-e=happy]');A.wait_for_timeout(900)
    print('A sees (muted):',A.evaluate("document.querySelectorAll('#emoLayer .emote').length"),'B sees own:',B.evaluate("document.querySelectorAll('#emoLayer .emote').length"))
    A.screenshot(path=O+'/mute-on.png')
    A.click('#board .tile[data-i="%d"]'%meB);A.wait_for_timeout(300);print('menu now:',A.inner_text('#emoMenu .mubtn'));A.click('#emoMenu .mubtn');A.wait_for_timeout(2500)
    B.click('#board .tile[data-i="%d"]'%meB);B.wait_for_timeout(400);B.click('#emoWheel .emobtn[data-e=cocky]');A.wait_for_timeout(900)
    print('A sees after unmute:',A.evaluate("[...document.querySelectorAll('#emoLayer .emote')].map(e=>e.className)"),'badge gone:',not A.is_visible('#board .tile[data-i="%d"] .emochip.mut'%meB))
    A.click('#board .tile[data-i="%d"]'%meB);A.wait_for_timeout(300);A.mouse.click(200,700);A.wait_for_timeout(200);print('closes on outside tap:',not A.is_visible('#emoMenu'))
    b.close()
print('errors',errs)
