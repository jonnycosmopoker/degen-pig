from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844}); pg.goto('http://localhost:8803'); pg.wait_for_timeout(500)
    seen=[]
    for i in range(40):
        r=pg.evaluate("()=>{const h=document.getElementById('hint').getBoundingClientRect(),t=document.getElementById('tray').getBoundingClientRect();return [Math.round(h.top),Math.round(t.top),Math.round(t.height),document.getElementById('tray').className,getComputedStyle(document.getElementById('hint')).bottom]}")
        if not seen or seen[-1]!=r: seen.append(r); print(i,r)
        pg.wait_for_timeout(100)
    b.close()
