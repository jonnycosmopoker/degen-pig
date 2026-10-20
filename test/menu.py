from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in((390,844),(360,640)):
        pg=b.new_page(viewport={'width':w,'height':h}); pg.goto('http://localhost:8798'); pg.wait_for_timeout(600)
        pg.screenshot(path='/tmp/claude-0/-home-claude/f3a73d25-10aa-5d56-8694-e7d916454734/scratchpad/otest/m-%d.png'%w)
        pg.click('#mSettings'); print(w,'settings opens:',pg.get_attribute('#app','data-phase'))
    b.close()
