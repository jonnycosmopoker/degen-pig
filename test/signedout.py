from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844})
    pg.goto('http://localhost:8794/?t=ABCDEF&p=oink'); pg.wait_for_timeout(600)
    print('msg:',pg.inner_text('#onMsg'),'| sign card:',pg.is_visible('#signCard'),'| host hidden:',not pg.is_visible('#hostBtn'))
    print('pending:',pg.evaluate("localStorage.getItem('degenpig-pending')"))
    pg.screenshot(path='/tmp/claude-0/-home-claude/f3a73d25-10aa-5d56-8694-e7d916454734/scratchpad/otest/s1-signedout.png')
    reqs=[]; pg.on('request',lambda r: reqs.append(r.url) if 'supabase' in r.url else None)
    pg.click('#gSignIn'); pg.wait_for_timeout(800); print('redirect:',reqs[:1])
    b.close()
