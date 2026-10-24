import sys
from playwright.sync_api import sync_playwright
errs=[]
def shake(pg,n=4):
    pg.evaluate("""n=>{for(let i=0;i<n;i++){const s=i%2?-1:1;window.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:22*s,y:6,z:3},accelerationIncludingGravity:{x:22*s,y:15.8,z:3},interval:16}))}}""",n)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2,reduced_motion='reduce')
    A=ctx.new_page();A.on('pageerror',lambda e:errs.append(str(e)))
    A.goto('http://localhost:8808');A.wait_for_timeout(400)
    print('hint:',A.inner_text('#hint'))
    d0=A.evaluate('__dp.S.dice.join()');shake(A);A.wait_for_timeout(1500);print('menu shake rolled dice:',A.evaluate('__dp.S.dice.join()'),'(was',d0+')')
    A.click('#mPass');A.click('#startBtn');A.wait_for_timeout(600)
    r0=A.evaluate('__dp.S.rolls.length');shake(A);A.wait_for_timeout(1800)
    print('phase',A.get_attribute('#app','data-phase'),'rolls before/after shake:',r0,A.evaluate('__dp.S.rolls.length'),'| at risk',A.inner_text('#v2'))
    shake(A,2);A.wait_for_timeout(1500);print('a gentle shake (2 jolts) does nothing:',A.evaluate('__dp.S.rolls.length'))
    # turn the setting off
    A.evaluate('__dp.S.shake=false');n=A.evaluate('__dp.S.rolls.length');shake(A);A.wait_for_timeout(1500);print('setting off, no roll:',A.evaluate('__dp.S.rolls.length')==n)
    b.close()
print('errors',errs)
