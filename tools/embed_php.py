#!/usr/bin/env python3
# coloca os arquivos PHP do rastreamento (desktop/php) dentro do main.js, entre os marcadores
import base64,re
D='desktop/'
b=lambda n:base64.b64encode(open(D+'php/'+n,'rb').read()).decode()
blk="/*TRKPHP*/const TRK_PHP={t:Buffer.from('%s','base64').toString('utf8'),h:Buffer.from('%s','base64').toString('utf8'),r:Buffer.from('%s','base64').toString('utf8')};/*ENDTRKPHP*/"%(b('t.php'),b('h.php'),b('r.php'))
s=open(D+'main.js',encoding='utf8').read()
if '/*TRKPHP*/' in s:
    s=re.sub(r'/\*TRKPHP\*/.*?/\*ENDTRKPHP\*/',lambda m:blk,s,flags=re.S)
else:
    i=s.index('async function hftpRun(')
    s=s[:i]+blk+'\n'+s[i:]
open(D+'main.js','w',encoding='utf8').write(s)
print('ok')
