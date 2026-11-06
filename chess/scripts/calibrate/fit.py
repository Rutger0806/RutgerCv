import json, math
H=json.load(open('harvest.json'))
def win(e, k=0.00368208):
    if e is None: return 50
    if e.get('mate') not in (None,):
        m=e['mate']; return 100 if m>0 else 0 if m<0 else 50
    return 50+50*(2/(1+math.exp(-k*e['cp']))-1)
def posWin(p,k):
    if 'term' in p: return 100 if p['term']=='bmated' else 0 if p['term']=='wmated' else 50
    return win(p['l1'],k)
rows=[]
for g in H:
    for color in 'wb':
        losses=[];
        for i,m in enumerate(g['moves']):
            if m['color']!=color: continue
            b=posWin(g['pos'][i],K:=0.00368208); a=posWin(g['pos'][i+1],K)
            if color=='b': b,a=100-b,100-a
            losses.append(max(0,b-a))
        y=g['acc']['white' if color=='w' else 'black']
        rows.append((y,losses,g['url'],color))
def cur(l): return sum(max(0,min(100,103.1668*math.exp(-0.04354*x)-3.1669)) for x in l)/len(l)
def rmse(f): return math.sqrt(sum((f(l)-y)**2 for y,l,_,_ in rows)/len(rows))
print('n',len(rows),'current formula RMSE',round(rmse(cur),2), 'mean bias', round(sum(cur(l)-y for y,l,_,_ in rows)/len(rows),2))
best=None
for k in [x/1000 for x in range(5,200,5)]:
    f=lambda l,k=k: sum(100*math.exp(-k*x) for x in l)/len(l)
    r=rmse(f)
    if not best or r<best[0]: best=(r,k)
print('exp fit',best)
# 2-param: a*exp(-k x)+c
bb=None
for k in [x/1000 for x in range(5,150,5)]:
  for c in range(-10,6):
    for a in range(95,112):
        f=lambda l,k=k,c=c,a=a: sum(max(0,min(100,a*math.exp(-k*x)+c)) for x in l)/len(l)
        r=rmse(f)
        if not bb or r<bb[0]: bb=(r,a,k,c)
print('a*exp(-kx)+c',bb)
for y,l,u,c in rows: print(round(y,1), round(cur(l),1), round(sum(l)/len(l),1), len(l))
