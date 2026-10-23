import sys
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]; BASE='http://localhost:8806'
with sync_playwright() as p:
    b=p.chromium.launch()
    def phone(tag):
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,reduced_motion='reduce'); ctx.add_init_script("localStorage.setItem('degenpig-auth',JSON.stringify({at:'dev-%s',rt:'',exp:9e9}))"%tag)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(tag+': '+str(e))); return pg
    A=phone('ace'); B=phone('bex'); C=phone('cy')
    A.goto(BASE); A.click('#mOnline'); A.fill('#onName','Ace'); A.click('#hostBtn'); A.click('#hLess'); A.click('#hLess'); A.click('#hCreate'); A.wait_for_selector('#room:not([hidden])')
    print('chat button in waiting room:',A.is_visible('#chatBtn'))
    B.goto(BASE); B.click('#mOnline'); B.fill('#onName','Bex'); B.wait_for_timeout(600); B.click('#lobbyList button[data-code]'); B.wait_for_selector('#play:not([hidden])')
    C.goto(BASE); C.click('#mOnline'); C.fill('#onName','Cy'); C.wait_for_timeout(1200); C.click('#liveList button[data-watch]'); C.wait_for_selector('#play:not([hidden])')
    A.wait_for_timeout(500)
    B.click('#chatBtn'); B.fill('#chatIn','gl everyone, prepare to get pigged'); B.press('#chatIn','Enter'); B.wait_for_timeout(300)
    B.fill('#chatIn','first to 100 buys drinks'); B.click('#chatSend'); B.wait_for_timeout(400)
    print('Ace badge:',A.inner_text('#chatBadge') if A.is_visible('#chatBadge') else None,'| Cy badge:',C.inner_text('#chatBadge') if C.is_visible('#chatBadge') else None)
    A.screenshot(path=O+'/1-badge.png')
    C.click('#chatBtn'); C.fill('#chatIn','watching this one, good luck both'); C.press('#chatIn','Enter'); C.wait_for_timeout(300)
    A.click('#chatBtn'); A.wait_for_timeout(300)
    print('Ace button text:',A.inner_text('#chatBtn'),'| badge hidden:',not A.is_visible('#chatBadge'))
    A.fill('#chatIn','<b>not bold</b> lol'); A.press('#chatIn','Enter'); A.wait_for_timeout(400)
    print('Ace chat:',A.inner_text('#chatList').replace('\n',' | '))
    A.screenshot(path=O+'/2-open.png'); B.screenshot(path=O+'/3-bex.png')
    A.click('#chatBtn'); A.wait_for_timeout(200); print('closed, overlay hidden:',not A.is_visible('#chatPane'),'| label:',A.inner_text('#chatLbl'))
    # spam limit
    for i in range(10): B.fill('#chatIn','spam %d'%i); B.press('#chatIn','Enter')
    B.wait_for_timeout(500); print('Ace badge after spam (max 6 get through):',A.inner_text('#chatBadge'))
    b.close()
print('errors',errs)
