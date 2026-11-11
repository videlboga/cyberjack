#!/usr/bin/env python3
"""Generate RU display titles for the Koikatsu animation library.

Reads animations/catalog.json + animations/glossary.json, writes
animations/ru_names.json: {id: ru-label RU tokens joined by ' · '}.
Unknown tokens stay as-is (no invented meanings). Deterministic, re-runnable.
"""
import json, re, sys
from collections import Counter
from pathlib import Path

AJ=Path("/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16")
OUT=AJ/'animations'/'ru_names.json'

SIZE_TOKENS={'L','M','S','F','LL','LM','LS','MM','MS','ML','SL','SS','SM'}
LEADING_SKIP={'L','M','S','F'}

def load():
    cat=json.load(open(AJ/'animations'/'catalog.json'))
    gl=json.load(open(AJ/'animations'/'glossary.json'))
    return cat, gl

def segment(token, stems, max_piece=20):
    """Greedy longest-first segmentation of token into known stems."""
    n=len(token); dp=[None]*(n+1); dp[0]=[]
    for i in range(1,n+1):
        for j in range(max(0,i-max_piece),i):
            if dp[j] is None: continue
            piece=token[j:i]
            if piece in stems:
                dp[i]=dp[j]+[piece]; break
    return dp[n]

def token_ru(tok, stems):
    """Return RU part for one raw token, or None to keep original text."""
    t=tok.strip()
    if not t: return None
    d=re.search(r'\d+$',t)
    digits=d.group(0) if d else ''
    base=t[:len(t)-len(digits)] if digits else t
    low=base.strip().lower()
    if not low: return None
    if low in stems:
        return stems[low]+(' '+digits if digits else '')
    seg=segment(low, stems)
    if seg and len(seg)>1:
        ru=[stems[p] for p in seg]
        return ' '.join(ru)+(' '+digits if digits else '')
    return None

def name_ru(name, stems):
    parts=[]; variants=[]; codes=[]
    pieces=re.split(r'[\s_]+', name.strip())
    first=True
    for p in pieces:
        if p.upper() in SIZE_TOKENS and (first or len(pieces)==1):
            if first and len(pieces)>1:
                variants.append(p.upper()); first=True; continue
        first=False
        if not p: continue
        ru=token_ru(p, stems)
        if ru: parts.append(ru)
        else:
            # короткие буквенные коды источника (A/B/C/D/R/M и т.п.) не переводим наизусть
            if re.fullmatch(r'[A-Za-z]{1,3}', p):
                codes.append(p)
            else:
                parts.append(p)
    label=' · '.join(x for x in parts if x).strip()
    if codes: label=(label+' · ' if label else '')+'['+' '.join(codes)+']'
    if not label: label=name.strip()
    if variants: label=f"{label} ({'/'.join(variants)})"
    return label

ROLE_SIZE={'L','M','S','LL','LM','LS','MM','MS','ML','SL','SS','SM'}

def scene_label(origin, name, scenes, roles, stems=None):
    """RU label from AnimationLoader scene map; None if no match."""
    if not scenes or '!' not in (origin or ''): return None
    entry=(origin.split('!',1)[1] or '')
    entry=re.sub(r'^[/\s]*(?:abdata/)?','',entry)
    scene_ru=scenes.get(entry)
    if not scene_ru and '/male/' in entry:
        scene_ru=scenes.get(entry.replace('/male/','/female/'))  # сцены KPlug парные (одинаковая нумерация)
    if not scene_ru: return None
    # роль из клипа: выкинуть размерный префикс
    pieces=[p for p in re.split(r'[\s_]+',name.strip()) if p]
    if len(pieces)>1 and pieces[0].upper() in ROLE_SIZE: pieces=pieces[1:]
    role=[]; codes=[]
    for p in pieces:
        d=re.search(r'\d+$',p); digits=d.group(0) if d else ''
        base=(p[:len(p)-len(digits)] if digits else p).lower()
        r=roles.get(base)
        if r: role.append(r+(' '+digits if digits else ''))
        elif re.fullmatch(r'[A-Za-z]{1,3}',p): codes.append(p)
        else:
            ru_p=token_ru(p,stems) if stems else None
            role.append(ru_p or p)
    label=scene_ru + ((' · '+' · '.join(role)) if role else '')
    if '/male/' in entry: label+=' · мужская сторона'
    if codes: label+=' ['+' '.join(codes)+']'
    return label

def main():
    cat,gl=load()
    stems=dict(gl.get('stems') or {})
    # сцены AnimationLoader (KPlug/Omega): путь бандла -> RU сцена + RU роли
    SCENES={}; ROLES={}
    epath=AJ/'animations'/'en_ru_scenes.json'
    if epath.exists():
        ed=json.loads(epath.read_text())
        SCENES=ed.get('scenes',{}); ROLES=ed.get('roles',{})
    mpath=AJ/'animations'/'animloader_names.json'
    PEOPLE={}
    AL={}
    if mpath.exists():
        al=json.loads(mpath.read_text())
        for pth,info in al.items():
            e=re.sub(r'^abdata/','',pth)
            AL[e]=info
            mode=info.get('mode') or ''
            if '3P' in mode: PEOPLE[e]=3; PEOPLE[e.replace('/female/','/male/')]=3
            elif mode=='lesbian': PEOPLE[e]=2
            else: PEOPLE[e]=2; PEOPLE[e.replace('/female/','/male/')]=2
    TC={}
    tpath=AJ/'animations'/'en_ru_tags.json'
    if tpath.exists(): TC=json.loads(tpath.read_text())
    # компактные формы для карточек вьювера
    for k,v in list(stems.items()):
        stems[k]=v.replace(' (состояние H-сцены)','').replace(' (custompose)','').replace(' (по-японски)','').replace(' (denma)','').replace(' (cut-in)','').replace(' (объект карты)','').replace(' (KKS)','').replace(' (вариант','(вариант')
    out={}; matched=0; total=0; scene_matched=0; ppl={}; tags={}; counts={'a':Counter(),'p':Counter(),'s':Counter()}
    def add_tag(tid,dim,tag):
        if not tag: return
        e=tags.setdefault(tid,{'a':[],'p':[],'s':[]})
        if tag not in e[dim]: e[dim].append(tag); counts[dim][tag]+=1
    def en_acts_for(en_text, kind, mode):
        low=' '+(en_text or '').lower()+' '
        for ent in TC.get('scene_en_acts',[]):
            for kw in ent['en']:
                if len(kw)>2 and re.search(r'\b'+re.escape(kw),low):
                    add_tag(cur_tid,'a',ent['tag']); break
        extra=TC.get('en_acts_extra_for_labels',{})
        for kw,tag in extra.items():
            if kw and re.search(r'\b'+re.escape(kw),low): add_tag(cur_tid,'s' if 'принужд' in tag or 'бдсм' in tag or 'оргазм' in tag else 'a',tag)
        mtag=TC.get('mode_acts',{}).get(mode)
        if mtag and mode!='houshi': add_tag(cur_tid,'a',mtag)
        if mode=='houshi':
            k={'Hand':'ручник · руками','Mouth':'орально','Breasts':'грудинг'}.get(kind)
            if k and not any(t in (tags.get(cur_tid) or {'a':[]})['a'] for t in ('массаж','ручник · руками','орально','грудинг')): add_tag(cur_tid,'a',k)
        elif mode=='houshi': add_tag(cur_tid,'a',mtag or 'услуга · минет/руками')
    def ru_label_tags(tid,label):
        low=label.lower()
        for ent in TC.get('label_acts',[]):
            for kw in ent['ru']:
                if kw.lower() in low: add_tag(tid,'a',ent['tag']); break
        for ent in TC.get('label_poses',[]):
            for kw in ent['ru']:
                if kw.lower() in low: add_tag(tid,'p',ent['tag']); break
        for ent in TC.get('label_styles',[]):
            for kw in ent['ru']:
                if kw.lower() in low: add_tag(tid,'s',ent['tag']); break
    for c in cat['clips']:
        total+=1
        origin=c.get('origin') or c.get('source') or ''
        cur_tid=c['id']
        name=c.get('name','') or ''
        ru=None
        entry=re.sub(r'^[/\s]*(?:abdata/)?','',origin.split('!',1)[1] or '') if '!' in origin else None
        cand=None
        if entry:
            probe=entry
            if probe not in SCENES and '/male/' in entry: probe=entry.replace('/male/','/female/')
            if probe in SCENES: cand=entry if entry in SCENES else probe
        if cand:
            ru=scene_label(origin,name,SCENES,ROLES,stems); scene_matched+=1
            for e in (entry, cand):
                if e in PEOPLE: ppl[c['id']]=PEOPLE[e]; break
        if not ru: ru=name_ru(name, stems)
        out[cur_tid]=ru
        if ru!=name: matched+=1
        # теги
        if cand:
            ai=AL.get(entry) or AL.get(cand)
            if ai: en_acts_for(ai.get('name'),ai.get('kind'),ai.get('mode') or '')
        if cand or c.get('category')=='h': ru_label_tags(cur_tid,ru or name)
    doc={'format':'koikatsu-ru-names-v1',
         'generated':__import__('datetime').date.today().isoformat(),
         'note':'RU-метки: сцены AnimationLoader (KPlug/Omega) по пути бандла + роли; остальное — токены имени из glossary.json; неизвестные коды сохранены как есть.',
         'people':ppl,
         'tags':tags,
         'tag_options':{d:cnt.most_common() for d,cnt in counts.items()},
         'names':out}
    tmp=OUT.with_suffix(OUT.suffix+'.tmp'); tmp.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':'))); tmp.replace(OUT)
    print('clips:',total,'translated:',matched,f'({matched/total:.0%})','scene-matched:',scene_matched)
    # coverage of playable only
    play=[c for c in cat['clips'] if c.get('playable')]
    pm=[c for c in play if out[c['id']]!=c.get('name','')]
    print('playable:',len(play),'translated:',len(pm),f'({len(pm)/len(play):.0%})')
    uniq=Counter(out.values())
    print('уникальных RU-меток:',len(uniq))

if __name__=='__main__':
    main()