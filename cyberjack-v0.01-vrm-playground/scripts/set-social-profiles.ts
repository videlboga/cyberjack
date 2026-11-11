import sqlite3, json

db = sqlite3.connect('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/cyberjack.sqlite')

# Эго-состояния по характерам (транзакционный анализ Берна)
profiles = {
    'PL-1': {  # Калибратор — контролирует, принимает решения, управляет процедурами
        'defaultEgoState': 'critical_parent',
        'lifePosition': 'ok_ok',
        'stressNeeds': ['clarity', 'autonomy'],
        'conversationHooks': ['протокол', 'границы', 'статус'],
    },
    'S-AV-01': {  # Мира — подстраивается, покорность спасает от боли, ждёт
        'defaultEgoState': 'adapted_child',
        'lifePosition': 'not_ok_ok',
        'stressNeeds': ['safety', 'approval'],
        'conversationHooks': ['границы', 'доверие', 'прошлое'],
    },
    'NPC-LAB-01': {  # Иона — собранная, наблюдательная, сдержанно-заботливая
        'defaultEgoState': 'nurturing_parent',
        'lifePosition': 'ok_ok',
        'stressNeeds': ['clarity', 'connection'],
        'conversationHooks': ['работа', 'лаборатория', 'наблюдения'],
    },
    'NPC-CAND-01': {  # Ника — практичная, настороженная, терпеливая
        'defaultEgoState': 'adult',
        'lifePosition': 'ok_ok',
        'stressNeeds': ['clarity', 'safety'],
        'conversationHooks': ['соглашения', 'условия', 'безопасность'],
    },
    'NPC-CAND-SUMI': {  # Суми — 18, кандидат, мягкая
        'defaultEgoState': 'free_child',
        'lifePosition': 'not_ok_ok',
        'stressNeeds': ['approval', 'connection'],
        'conversationHooks': ['ступни', 'массаж', 'протокол'],
    },
    'NPC-CAND-GEN-02': {  # Эли — 29, кандидат, зрелая
        'defaultEgoState': 'adult',
        'lifePosition': 'ok_ok',
        'stressNeeds': ['connection', 'clarity'],
        'conversationHooks': ['работа', 'будущее', 'статус'],
    },
    'NPC-CAND-GEN-03': {  # Мара — 25, кандидат, независимая
        'defaultEgoState': 'rebellious_child',
        'lifePosition': 'not_ok_not_ok',
        'stressNeeds': ['autonomy', 'safety'],
        'conversationHooks': ['свобода', 'правила', 'границы'],
    },
    'NPC-CAND-GEN-04': {  # Май — 19, asset, наблюдательная
        'defaultEgoState': 'adapted_child',
        'lifePosition': 'not_ok_ok',
        'stressNeeds': ['approval', 'safety'],
        'conversationHooks': ['наблюдения', 'протокол', 'другие'],
    },
    'NPC-CAND-GEN-05': {  # Рен — 22, кандидат, спокойный
        'defaultEgoState': 'adult',
        'lifePosition': 'ok_ok',
        'stressNeeds': ['autonomy', 'clarity'],
        'conversationHooks': ['работа', 'статус', 'будущее'],
    },
}

updated = 0
for cid, social in profiles.items():
    row = db.execute("SELECT profile_json FROM characters WHERE id=?", (cid,)).fetchone()
    if not row:
        print(f"  ! нет персонажа {cid}")
        continue
    pj = json.loads(row[0] or '{}')
    pj['social'] = social
    db.execute("UPDATE characters SET profile_json=? WHERE id=?", (json.dumps(pj, ensure_ascii=False), cid))
    updated += 1
    print(f"  {cid}: defaultEgoState={social['defaultEgoState']}, lifePosition={social['lifePosition']}")

db.commit()
print(f"\nОбновлено персонажей: {updated}")
