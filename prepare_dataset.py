#!/usr/bin/env python3
"""
Подготовка датасета для LoRA обучения.
1. Найти все картинки рекурсивно
2. Удалить дубликаты (perceptual hash)
3. Удалить картинки с текстом/водяными знаками (OCR + эвристика)
4. Ресайз до max 768px по длинной стороне
5. Сохранить в целевую папку
"""
import os
import sys
import hashlib
import shutil
from pathlib import Path
from collections import defaultdict

import imagehash
from PIL import Image, ImageOps
import pytesseract

SRC_DIR = Path("/home/cyberkitty/hdd_backup/Новая папка2")
DST_DIR = Path("/home/cyberkitty/Projects/cyberjack/lora_dataset/images")
MAX_SIZE = 768
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# Пороговое расстояние хэшей для дубликатов
DUP_HASH_THRESHOLD = 5

def find_images(src_dir):
    """Рекурсивно найти все картинки."""
    files = []
    for root, dirs, filenames in os.walk(src_dir):
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in EXTS:
                files.append(Path(root) / fn)
    return sorted(files)

def compute_phash(img_path):
    """Вычислить perceptual hash. Возвращает None при ошибке."""
    try:
        with Image.open(img_path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            return imagehash.phash(im, hash_size=16)
    except Exception:
        return None

def has_text(img_path):
    """
    Определить наличие текста/водяных знаков.
    Комбинированный подход:
    1. OCR (tesseract) — если найдено достаточно слов с высокой уверенностью
    2. Эвристика: большие белые области с тёмным текстом
    """
    try:
        with Image.open(img_path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            w, h = im.size
            # Пропускаем слишком маленькие
            if w < 100 or h < 100:
                return False

            # --- OCR подход (быстрый, на уменьшенной версии) ---
            scale = min(1.0, 1000 / max(w, h))
            if scale < 1.0:
                ocr_im = im.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
            else:
                ocr_im = im
            try:
                # Получаем данные с оценками уверенности
                data = pytesseract.image_to_data(
                    ocr_im, lang='eng', output_type=pytesseract.Output.DICT
                )
                conf_words = 0
                for i, conf in enumerate(data['conf']):
                    try:
                        c = int(float(conf))
                    except (ValueError, TypeError):
                        continue
                    text = data['text'][i].strip()
                    if c > 60 and len(text) >= 2:
                        conf_words += 1
                if conf_words >= 3:
                    return True
            except Exception:
                pass

            # --- Эвристика: большие белые области ---
            # Конвертируем в grayscale, бинаризуем
            gray = im.convert("L")
            # Считаем долю "белых" пикселей (>240)
            hist = gray.histogram()
            total = w * h
            white_pixels = sum(hist[240:])
            white_ratio = white_pixels / total
            # Считаем долю "тёмных" пикселей (<60)
            dark_pixels = sum(hist[:60])
            dark_ratio = dark_pixels / total

            # Если много белого и есть тёмные пиксели — возможен текст
            # Но аниме арт часто имеет белый фон, поэтому нужен более строгий критерий
            # Проверяем: белые полосы (водяные знаки часто внизу/вверху)
            # Анализируем нижние 15% и верхние 15% изображения
            top_band = gray.crop((0, 0, w, max(1, int(h*0.08))))
            bottom_band = gray.crop((0, int(h*0.92), w, h))
            top_hist = top_band.histogram()
            bottom_hist = bottom_band.histogram()
            top_total = top_band.size[0] * top_band.size[1]
            bottom_total = bottom_band.size[0] * bottom_band.size[1]
            top_white = sum(top_hist[240:]) / top_total if top_total else 0
            bottom_white = sum(bottom_hist[240:]) / bottom_total if bottom_total else 0

            # Если в верхней или нижней полосе >80% белого и есть тёмные пиксели — водяной знак/текст
            if (top_white > 0.85 or bottom_white > 0.85) and dark_ratio > 0.02:
                return True

            return False
    except Exception:
        return False

def resize_and_save(img_path, dst_path, max_size=MAX_SIZE):
    """Ресайз до max_size по длинной стороне с сохранением пропорций."""
    with Image.open(img_path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        if max(w, h) > max_size:
            ratio = max_size / max(w, h)
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            im = im.resize((new_w, new_h), Image.LANCZOS)
        # Сохраняем как PNG для качества
        im.save(dst_path, "PNG", optimize=True)

def main():
    DST_DIR.mkdir(parents=True, exist_ok=True)

    print("=== Поиск изображений ===")
    files = find_images(SRC_DIR)
    total_found = len(files)
    print(f"Найдено файлов: {total_found}")

    # --- Дедупликация по perceptual hash ---
    print("\n=== Дедупликация (perceptual hash) ===")
    hash_map = {}  # phash -> first filepath
    unique_files = []
    duplicates = []
    unreadable = []

    for i, fp in enumerate(files):
        if (i+1) % 100 == 0:
            print(f"  обработано {i+1}/{total_found}...")
        ph = compute_phash(fp)
        if ph is None:
            unreadable.append(fp)
            continue
        # Проверяем на дубликат
        is_dup = False
        for existing_ph, existing_fp in hash_map.items():
            if (ph - existing_ph) <= DUP_HASH_THRESHOLD:
                duplicates.append((fp, existing_fp))
                is_dup = True
                break
        if not is_dup:
            hash_map[ph] = fp
            unique_files.append(fp)

    print(f"Уникальных: {len(unique_files)}")
    print(f"Дубликатов удалено: {len(duplicates)}")
    print(f"Нечитабельных: {len(unreadable)}")

    # --- Определение текста/водяных знаков ---
    print("\n=== Определение текста/водяных знаков ===")
    clean_files = []
    text_files = []

    for i, fp in enumerate(unique_files):
        if (i+1) % 50 == 0:
            print(f"  проверка текста {i+1}/{len(unique_files)}...")
        if has_text(fp):
            text_files.append(fp)
        else:
            clean_files.append(fp)

    print(f"С текстом/водяными знаками: {len(text_files)}")
    print(f"Чистых: {len(clean_files)}")

    # --- Ресайз и сохранение ---
    print(f"\n=== Ресайз и сохранение в {DST_DIR} ===")
    # Очищаем целевую папку
    for f in DST_DIR.glob("*"):
        if f.is_file():
            f.unlink()

    saved = 0
    for i, fp in enumerate(clean_files):
        if (i+1) % 100 == 0:
            print(f"  сохранено {i+1}/{len(clean_files)}...")
        # Генерируем уникальное имя
        idx = i + 1
        dst_name = f"ikelag_{idx:05d}.png"
        dst_path = DST_DIR / dst_name
        try:
            resize_and_save(fp, dst_path)
            saved += 1
        except Exception as e:
            print(f"  ОШИБКА сохранения {fp}: {e}")

    print(f"\n=== ИТОГОВЫЙ ОТЧЁТ ===")
    print(f"Всего найдено:      {total_found}")
    print(f"Дубликатов:         {len(duplicates)}")
    print(f"Нечитабельных:      {len(unreadable)}")
    print(f"С текстом/WZ:       {len(text_files)}")
    print(f"Сохранено в датасет: {saved}")
    print(f"Целевая папка:      {DST_DIR}")

    # Сохраняем списки для отчётности
    report_dir = DST_DIR.parent / "reports"
    report_dir.mkdir(exist_ok=True)
    with open(report_dir / "duplicates.txt", "w") as f:
        for dup, orig in duplicates:
            f.write(f"{dup}\t-> dup of\t{orig}\n")
    with open(report_dir / "text_removed.txt", "w") as f:
        for fp in text_files:
            f.write(f"{fp}\n")
    with open(report_dir / "unreadable.txt", "w") as f:
        for fp in unreadable:
            f.write(f"{fp}\n")
    print(f"\nСписки удалённых сохранены в: {report_dir}")

if __name__ == "__main__":
    main()