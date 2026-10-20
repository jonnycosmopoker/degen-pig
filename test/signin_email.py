import sys, json
from playwright.sync_api import sync_playwright
O=sys.argv[1]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror',lambda e: errs.append(str(e)))
    calls=[]
    def otp(route): calls.append(('otp',route.request.post_data)); route.fulfill(status=200,content_type='application/json',body='{}')
    def verify(route):
        d=json.loads(route.request.post_data); calls.append(('verify',d))
        if d['token']=='123456': route.fulfill(status=200,content_type='application/json',body=json.dumps({'access_token':'dev-eve','refresh_token':'','expires_in':3600}))
        else: route.fulfill(status=403,content_type='application/json',body='{"msg":"Token has expired or is invalid"}')
    pg.route('**/auth/v1/otp',otp); pg.route('**/auth/v1/verify',verify)
    pg.goto('http://localhost:8797/?t=ABCDEF'); pg.wait_for_timeout(400)
    print('msg:',pg.inner_text('#onMsg'))
    pg.click('#emSend'); print('bad email note:',pg.inner_text('#emNote'))
    pg.fill('#emIn','eve@example.com'); pg.click('#emSend'); pg.wait_for_timeout(300); print('sent note:',pg.inner_text('#emNote'),'| code box:',pg.is_visible('#codeIn'))
    pg.screenshot(path=O+'/e1-code.png')
    pg.fill('#codeIn','000000'); pg.click('#codeGo'); pg.wait_for_timeout(300); print('wrong code:',pg.inner_text('#emNote'))
    pg.fill('#codeIn','123456'); pg.click('#codeGo'); pg.wait_for_timeout(1200)
    print('signed in line:',pg.inner_text('#acctLine') if pg.is_visible('#acctLine') else None,'| phase:',pg.get_attribute('#app','data-phase'),'| msg:',pg.inner_text('#onMsg'))
    print('calls:',[c[0] for c in calls])
    b.close()
print('errors',errs)
