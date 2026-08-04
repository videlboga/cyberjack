"""Review API server — serves image index for review.html
Scans ALL character-images except interactions and interactions-expanded."""
import http.server, os, json

CYBERJACK = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01'
PUBLIC = os.path.join(CYBERJACK, 'public')
CHAR_IMG = os.path.join(PUBLIC, 'character-images')
PORT = 3002

EXCLUDE_DIRS = {'interactions', 'interactions-expanded'}

# Russian descriptions
RU = {
    chars: {'mira': 'Мира', 'iona': 'Иона', 'nika': 'Ника', 'sumi': 'Суми', 'mika': 'Мика'} for chars in [{}]
} if False else {
    'chars': {'mira': 'Мира', 'iona': 'Иона', 'nika': 'Ника', 'sumi': 'Суми', 'mika': 'Мика'},
    'families': {
        'penetration': 'Проникновение', 'oral': 'Оральный секс', 'manual': 'Ручная стимуляция',
        'toy': 'Игрушки', 'partner': 'Партнёрша', 'kissing': 'Поцелуи',
        'contact': 'Контакт', 'poses': 'Положения', 'equipment': 'Оборудование', 'clothing': 'Одежда',
    },
    'variants': {
        'vaginal_missionary': 'Вагинально, миссионерская', 'vaginal_doggy': 'Вагинально, догги',
        'vaginal_standing': 'Вагинально, стоя', 'anal_missionary': 'Анально, миссионерская',
        'anal_doggy': 'Анально, догги', 'anal_standing': 'Анально, стоя',
        'clitoral': 'Стимуляция клитора', 'vaginal_fingering': 'Вагинальная пальпация',
        'anal_fingering': 'Анальная пальпация',
        'giving_kneeling': 'Отдаёт, на коленях', 'giving_deep': 'Отдаёт, глубоко',
        'giving_assisted': 'Отдаёт с помощницей', 'receiving_facesitting': 'Принимает, фейситтинг',
        'receiving_spread': 'Принимает, ноги раздвинуты',
        'licking': 'Провести языком', 'light_kiss': 'Коротко поцеловать',
        'deep_kiss': 'Поцеловать глубоко',
        'fingering_kiss': 'Пальпация с поцелуем', 'facesitting_receiving': 'Фейситтинг принимает',
        'facesitting_giving': 'Фейситтинг отдаёт',
        'close_kiss': 'Близкий поцелуй', 'kiss_with_touching': 'Поцелуй с касаниями',
        'external_vibrator': 'Вибратор снаружи', 'internal_vibrator': 'Вибратор внутри',
        'dildo_vaginal': 'Дильдо вагинально', 'dildo_anal': 'Дильдо анально',
        'feather_stroke': 'Провести пером', 'gentle_stroke': 'Мягко погладить',
        'tickle': 'Пощекотать', 'deep_massage': 'Надавить и размять',
        'ice_cube': 'Коснуться льдом', 'hot_wax': 'Капнуть воском',
        'light_bite': 'Прикусить', 'hard_bite': 'Укусить до боли',
        'pinch': 'Ущипнуть', 'scratching': 'Провести ногтями',
        'slap': 'Шлёпнуть', 'hard_slap': 'Ударить ладонью',
        'firm_grip': 'Сильно сжать', 'needle_prick': 'Сделать укол иглой',
        'belt_strike': 'Ударить ремнём', 'whip_strike': 'Ударить хлыстом',
        'taser_shock': 'Дать разряд электрошокером', 'hair_pull': 'Потянуть за волосы',
        'wait': 'Дать паузу',
        'pose_standing': 'Поставить прямо', 'pose_sitting': 'Посадить',
        'pose_kneeling': 'Поставить на колени', 'pose_lying_down': 'Уложить',
        'pose_all_fours': 'Поставить на четвереньки', 'pose_spread_eagle': 'Широко раскрыть',
        'act_hold_exposure': 'Показать тело', 'act_end_exposure': 'Прекратить показ',
        'act_present_feet': 'Предъявить ступни', 'act_end_feet_presentation': 'Завершить осмотр ступней',
        'act_suspend_wrists': 'Подвесить за запястья', 'act_release_wrists': 'Снять с подвеса',
        'act_apply_handcuffs': 'Надеть наручники', 'act_remove_handcuffs': 'Снять наручники',
        'act_apply_ankle_cuffs': 'Надеть ножные манжеты', 'act_remove_ankle_cuffs': 'Снять ножные манжеты',
        'act_apply_restraint_belt': 'Зафиксировать руки на поясе', 'act_remove_restraint_belt': 'Освободить руки от пояса',
        'act_apply_collar': 'Надеть ошейник', 'act_remove_collar': 'Снять ошейник',
        'act_shock_collar': 'Разряд через ошейник',
        'eq_blindfold_apply': 'Надеть повязку', 'eq_blindfold_remove': 'Снять повязку',
        'eq_gag_apply': 'Вставить кляп', 'eq_gag_remove': 'Вынуть кляп',
        'act_insert_plug': 'Ввести сенсорный плаг', 'act_activate_plug': 'Включить плаг',
        'act_deactivate_plug': 'Выключить плаг', 'act_remove_plug': 'Извлечь плаг',
        'act_start_vibrator': 'Закрепить вибратор', 'act_adjust_vibration': 'Усилить вибрацию',
        'act_stop_vibrator': 'Убрать вибратор', 'vibrator_pulse': 'Дать импульс',
        'act_connect_tens': 'Закрепить электроды TENS', 'act_start_electrostimulation': 'Включить электростимуляцию',
        'act_adjust_electrostimulation': 'Усилить электростимуляцию',
        'act_stop_electrostimulation': 'Остановить электростимуляцию', 'act_disconnect_tens': 'Снять электроды TENS',
        'eq_clothe_jumpsuit': 'Надеть комбинезон', 'eq_clothe_jumpsuit_remove': 'Снять комбинезон',
        'eq_clothe_underwear': 'Надеть бельё', 'eq_clothe_underwear_remove': 'Снять бельё',
        'eq_clothe_lab_gown': 'Надеть лаб. рубашку', 'eq_clothe_lab_gown_remove': 'Снять лаб. рубашку',
        'eq_clothe_calibration_set': 'Надеть калибр. комплект', 'eq_clothe_calibration_set_remove': 'Снять калибр. комплект',
        'eq_clothe_dress': 'Надеть платье', 'eq_clothe_dress_remove': 'Снять платье',
        'eq_clothe_stockings': 'Надеть чулки', 'eq_clothe_stockings_remove': 'Снять чулки',
    },
    'wardrobes': {
        'nude': 'Обнажена', 'underwear_displaced': 'Бельё сдвинуто',
        'stockings_displaced': 'Чулки, бельё сдвинуто', 'open_top': 'Рубашка расстёгнута',
    },
    'phases': {'sustain': 'Спокойная фаза', 'release': 'Разрядка', 'neutral': 'Нейтрально'},
    'affects': {
        'guarded': 'напряжённое выражение', 'receptive': 'принимающее выражение',
        'mixed': 'смешанное выражение', 'climax': 'оргазм', 'neutral': 'нейтрально',
    },
    'categories': {
        'rendered': 'Базовые позы', 'bodyparts': 'Части тела', 'actions': 'Действия',
        'intimacy': 'Интимность', 'look-tests': 'Тесты луков',
        'calibration-core': 'Калибровка (core)', 'calibration-v4': 'Калибровка v4',
    },
}

def scan_dir(rel_path, category):
    """Scan a directory for PNGs, infer metadata from path."""
    items = []
    base = os.path.join(CHAR_IMG, rel_path)
    if not os.path.isdir(base):
        return items
    
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in sorted(files):
            if not fname.endswith('.png'): continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, CHAR_IMG)
            url = f'/character-images/{rel}'
            
            # Parse path structure
            parts = rel.split(os.sep)
            char, family, variant, wardrobe, phase, affect = '', '', '', '', '', ''
            description = ''
            
            if rel_path == 'intimacy' and len(parts) >= 4:
                char = parts[1]
                family = parts[2]
                variant = parts[3]
                stem = fname[:-4]
                wp = stem.split('__')
                wardrobe = wp[0] if len(wp) > 0 else ''
                if len(wp) == 3:
                    phase, affect = wp[1], wp[2]
                elif len(wp) == 4:
                    phase, affect = wp[1], wp[3]
            elif rel_path == 'actions' and len(parts) >= 3:
                category_name = parts[1]
                family = category_name
                variant = fname[:-4]
                char = ''
            elif rel_path == 'actions-by-point' and len(parts) >= 3:
                point_id = parts[1]
                action_id = fname[:-4]
                family = 'actions-by-point'
                variant = action_id
                char = ''
                # Build description with point name
                point_ru = {
                    'hair': 'волосы', 'face': 'лицо', 'lips': 'губы', 'neck': 'шея',
                    'shoulders': 'плечи', 'chest': 'грудь', 'nipples': 'соски',
                    'belly': 'живот', 'back': 'спина', 'waist': 'талия',
                    'arms': 'руки', 'hands': 'кисти', 'inner_thighs': 'внутр. бёдра',
                    'legs': 'ноги', 'knees': 'колени', 'feet': 'ступни',
                    'buttocks': 'ягодицы', 'vulva': 'вульва', 'clitoris': 'клитор',
                    'vagina': 'влагалище', 'anus': 'анус',
                }.get(point_id, point_id)
                action_ru = RU.get('variants', {}).get(action_id, action_id)
                description = f'{action_ru} — точка: {point_ru}'
            elif rel_path == 'bodyparts' and len(parts) >= 3:
                char = parts[1]
                variant = fname[:-4]
                family = 'bodyparts'
            elif rel_path == 'rendered' and len(parts) >= 3:
                char = parts[1]
                stem = fname[:-4]
                # {pose}__{clothing}__none__{state}.png
                wp = stem.split('__')
                variant = wp[0] if len(wp) > 0 else stem
                wardrobe = wp[1] if len(wp) > 1 else ''
                family = 'rendered'
            elif rel_path.startswith('look-tests'):
                family = 'look-tests'
                char = ''
                variant = fname[:-4]
            elif rel_path.startswith('calibration'):
                family = rel_path
                char = ''
                variant = fname[:-4]
            else:
                family = category
                variant = fname[:-4]
            
            # Build description (skip if already set, e.g. actions-by-point)
            if not description:
                desc_parts = []
                if char and char in RU['chars']:
                    desc_parts.append(RU['chars'][char])
                if family and family in RU['families']:
                    desc_parts.append(RU['families'][family])
                if variant:
                    v = variant.replace('.png', '')
                    if v in RU['variants']:
                        desc_parts.append(RU['variants'][v])
                    else:
                        desc_parts.append(v)
                if wardrobe and wardrobe in RU['wardrobes']:
                    desc_parts.append(RU['wardrobes'][wardrobe])
                if phase and phase in RU['phases']:
                    desc_parts.append(RU['phases'][phase])
                if affect and affect in RU['affects']:
                    desc_parts.append(RU['affects'][affect])
                description = '. '.join(desc_parts) if desc_parts else rel
            
            items.append({
                'url': url,
                'path': rel,
                'char': char,
                'family': family,
                'variant': variant,
                'wardrobe': wardrobe,
                'phase': phase,
                'affect': affect,
                'category': category,
                'description': description,
            })
    return items

def scan_all():
    items = []
    if not os.path.isdir(CHAR_IMG):
        return items
    for entry in sorted(os.listdir(CHAR_IMG)):
        if entry in EXCLUDE_DIRS: continue
        full = os.path.join(CHAR_IMG, entry)
        if not os.path.isdir(full): continue
        items.extend(scan_dir(entry, entry))
    return items

class ReviewHandler(http.server.SimpleHTTPRequestHandler):
    _cache = None
    _cache_time = 0
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)
    
    def do_GET(self):
        if self.path.startswith('/review-api/index'):
            import time, urllib.parse
            # Parse query params
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            page = int(qs.get('page', ['0'])[0])
            page_size = int(qs.get('page_size', ['60'])[0])
            category = qs.get('category', [''])[0]
            char = qs.get('char', [''])[0]
            
            # Build/reuse cache
            now = time.time()
            if ReviewHandler._cache is None or now - ReviewHandler._cache_time > 30:
                all_items = scan_all()
                ReviewHandler._cache = all_items
                ReviewHandler._cache_time = now
            
            all_items = ReviewHandler._cache
            
            # Filter
            filtered = all_items
            if category:
                filtered = [i for i in filtered if i.get('category') == category]
            if char:
                filtered = [i for i in filtered if i.get('char') == char]
            
            total = len(filtered)
            start = page * page_size
            page_items = filtered[start:start + page_size]
            
            response = json.dumps({
                'items': page_items,
                'total': total,
                'page': page,
                'page_size': page_size,
                'pages': (total + page_size - 1) // page_size,
                'ru': RU,
            }).encode()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        elif self.path.startswith('/review-api/abp-seeds'):
            # Group actions-by-point by point/action, showing all 4 seed variants
            import os as _os, json as _json
            abp_base = _os.path.join(CHAR_IMG, 'actions-by-point')
            groups = []
            points_set = set()
            if _os.path.isdir(abp_base):
                for point in sorted(_os.listdir(abp_base)):
                    pd = _os.path.join(abp_base, point)
                    if not _os.path.isdir(pd): continue
                    points_set.add(point)
                    for fname in sorted(_os.listdir(pd)):
                        if not fname.endswith('.png'): continue
                        stem = fname[:-4]
                        # Parse: action, action_sN, action_altN
                        if '_alt' in stem and stem.rsplit('_alt',1)[1].isdigit():
                            action, snum = stem.rsplit('_alt', 1)
                            seed_idx = 100 + int(snum)  # alt1=101, alt2=102 to sort after originals
                        elif '_s' in stem and stem.rsplit('_s',1)[1].isdigit():
                            action, snum = stem.rsplit('_s', 1)
                            seed_idx = int(snum)
                        else:
                            action = stem
                            seed_idx = 1
                        # Find or create group
                        key = f'{point}/{action}'
                        g = None
                        for gg in groups:
                            if gg['key'] == key:
                                g = gg
                                break
                        if not g:
                            g = {'key': key, 'point': point, 'action': action, 'images': []}
                            groups.append(g)
                        g['images'].append({
                            'url': f'/character-images/actions-by-point/{point}/{fname}',
                            'seedLabel': f's{seed_idx}',
                            'seed': seed_idx,
                            'path': f'actions-by-point/{point}/{fname}',
                        })
            # Sort images within each group by seed
            for g in groups:
                g['images'].sort(key=lambda i: i['seed'])
            response = _json.dumps({
                'groups': groups,
                'points': sorted(points_set),
            }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        elif self.path == '/review-api/abp-seed-selections' and self.command == 'POST':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            selections = json.loads(body)
            save_path = os.path.join(CYBERJACK, 'abp-seed-selections.json')
            with open(save_path, 'w') as f:
                json.dump(selections, f, indent=2)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'saved': len(selections)}).encode())
        elif self.path == '/review-api/abp-seed-selections' and self.command == 'GET':
            save_path = os.path.join(CYBERJACK, 'abp-seed-selections.json')
            if os.path.exists(save_path):
                with open(save_path) as f:
                    data = f.read()
            else:
                data = '{}'
            response = data.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        elif self.path.startswith('/review-api/tickling-seeds'):
            import os as _os, json as _json, glob as _glob
            seed_dir = '/home/cyberkitty/comfyui/output/tickling_seed_test'
            groups = []
            chars_set = set()
            if _os.path.isdir(seed_dir):
                for fname in sorted(_os.listdir(seed_dir)):
                    if not fname.endswith('.png'): continue
                    # Parse: char__tickling__affect__sSEED.png
                    parts = fname.replace('.png','').split('__')
                    if len(parts) != 4: continue
                    char, _, affect, seed_part = parts
                    seed = int(seed_part[1:]) if seed_part.startswith('s') else 0
                    chars_set.add(char)
                    key = f'{char}_{affect}'
                    g = None
                    for gg in groups:
                        if gg['key'] == key:
                            g = gg; break
                    if not g:
                        g = {'key': key, 'char': char, 'affect': affect, 'images': []}
                        groups.append(g)
                    g['images'].append({
                        'url': f'/tickling-seed-images/{fname}',
                        'seedLabel': f's{seed}',
                        'seed': seed,
                    })
            for g in groups:
                g['images'].sort(key=lambda i: i['seed'])
            response = _json.dumps({'groups': groups, 'chars': sorted(chars_set)}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        elif self.path.startswith('/tickling-seed-images/'):
            import os as _os, urllib.parse as _up
            fname = _up.unquote(self.path.split('/tickling-seed-images/')[1])
            fpath = _os.path.join('/home/cyberkitty/comfyui/output/tickling_seed_test', fname)
            if _os.path.isfile(fpath):
                with open(fpath, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_response(404); self.end_headers()
        elif self.path == '/review-api/tickling-seed-selections' and self.command == 'POST':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            selections = json.loads(body)
            save_path = os.path.join(CYBERJACK, 'tickling-seed-selections.json')
            with open(save_path, 'w') as f:
                json.dump(selections, f, indent=2)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'saved': len(selections)}).encode())
        elif self.path == '/review' or self.path == '/review.html':
            self.path = '/review.html'
            super().do_GET()
        elif self.path == '/abp-seed-review' or self.path == '/abp-seed-review.html':
            self.path = '/abp-seed-review.html'
            super().do_GET()
        elif self.path == '/tickling-seed-review' or self.path == '/tickling-seed-review.html':
            self.path = '/tickling-seed-review.html'
            super().do_GET()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/review-api/submit':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            data = json.loads(body)
            
            path = data.get('path', '')
            status = data.get('status', '')
            reasons = data.get('reasons', [])
            note = data.get('note', '')
            
            # Write to files — deduplicate by path
            if status == 'approved':
                approved_path = os.path.join(CYBERJACK, 'review-approved.txt')
                existing = set()
                if os.path.exists(approved_path):
                    with open(approved_path) as f:
                        existing = set(l.strip() for l in f)
                existing.discard(path)
                with open(approved_path, 'a') as f:
                    f.write(f'{path}\n')
            elif status == 'rejected':
                rejected_path = os.path.join(CYBERJACK, 'review-rejected.txt')
                reason_str = ', '.join(reasons) if reasons else 'no_reason'
                line = f'{path} | {reason_str}'
                if note:
                    line += f' | {note}'
                # Read existing, remove old entry for this path
                lines = []
                if os.path.exists(rejected_path):
                    with open(rejected_path) as f:
                        lines = [l.rstrip('\n') for l in f if l.strip() and '|' in l]
                lines = [l for l in lines if not l.startswith(path + ' |')]
                lines.append(line)
                with open(rejected_path, 'w') as f:
                    f.write('\n'.join(lines) + '\n')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True}).encode())
        elif self.path == '/review-api/abp-seed-selections':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            selections = json.loads(body)
            save_path = os.path.join(CYBERJACK, 'abp-seed-selections.json')
            with open(save_path, 'w') as f:
                json.dump(selections, f, indent=2)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'saved': len(selections)}).encode())
        elif self.path == '/review-api/tickling-seed-selections':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            selections = json.loads(body)
            save_path = os.path.join(CYBERJACK, 'tickling-seed-selections.json')
            with open(save_path, 'w') as f:
                json.dump(selections, f, indent=2)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'saved': len(selections)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

from http.server import ThreadingHTTPServer

if __name__ == '__main__':
    print(f'Review server on http://localhost:{PORT}/review')
    items = scan_all()
    print(f'Found {len(items)} images')
    from collections import Counter
    cats = Counter(i.get('category','?') for i in items)
    for cat, count in cats.most_common():
        print(f'  {cat}: {count}')
    ThreadingHTTPServer(('0.0.0.0', PORT), ReviewHandler).serve_forever()