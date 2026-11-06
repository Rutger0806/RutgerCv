import json, math
H=json.load(open('harvest.json'))
def win(e):
    if e is None: return 50
    if e.get('mate') is not None:
        m=e['mate']; return 100 if m>0 else 0 if m<0 else 50
    return 50+50*(2/(1+math.exp(-0.00368208*e['cp']))-1)
def pw(p):
    if 'term' in p: return 100 if p['term']=='bmated' else 0 if p['term']=='wmated' else 50
    return win(p['l1'])
g=[x for x in H if '186637001566' in x['url']][0]
print(g['white'],g['black'],g['acc'])
for i,m in enumerate(g['moves']):
    c=m['color']; b=pw(g['pos'][i]); a=pw(g['pos'][i+1])
    if c=='b': b,a=100-b,100-a
    best=g['pos'][i]['l1']['mv'] if 'l1' in g['pos'][i] and g['pos'][i]['l1'] else None
    sec=g['pos'][i].get('l2')
    gap=None
    if sec:
        s=win(sec); s= s if c=='w' else 100-s; gap=round((b)-s,1)
    l=round(max(0,b-a),1)
    flag = '<<' if l>=3 or (gap and gap>=10 and m['uci']==best) else ''
    print(f"{i//2+1}{'.' if c=='w' else '...'} {m['san']:7} before={b:5.1f} loss={l:5.1f} best={'Y' if m['uci']==best else ' '} gap={gap} {flag}")
