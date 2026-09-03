# Проверка шумового гейта ориентации splat в dump-terrain.py — три опыта одной командой.
# Держит доказательную базу правки: без неё следующий, кто тронет гейт, будет проверять с нуля.
#
# Вход:  файлы клиента EFT (Таможня sharedassets17+level17, Развязка sharedassets63+level63)
#        и сам scripts/eft-terrain/dump-terrain.py — опыты 1 и 2 гоняют ЕГО, точечно изменив
#        исходник в памяти: боевой код не трогается, меняется только его вход или порог.
# Выход: по каждому опыту «ожидалось / получилось / сошлось»; exit 1 — хоть один не сошёлся,
#        exit 2 — файлов клиента нет и опыты 1-2 прогнать не на чем.
#
# Запуск: python scripts/eft-terrain/check-orientation-gate.py [<EscapeFromTarkov_Data>] [<рабочий каталог>]
#
# ⚠️ Оговорка, на которой стоит честность опыта 2: ORIENT_MIRROR_MIN в dump-terrain.py обязан
# оставаться ПРОИЗВОДНЫМ от ORIENT_MIN (`ORIENT_MIN * ORIENT_MARGIN`). Опыт сдвигает ORIENT_MIN
# и ждёт, что фатальный порог уедет вместе с ним; зашитое туда число оставит опыт зелёным,
# но проверять он будет уже не тот код.

import sys, os, ast, glob, shutil, tempfile, subprocess
import numpy as np

try:
    sys.stdout.reconfigure(errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DUMP = os.path.join(HERE, 'dump-terrain.py')
EFT = sys.argv[1] if len(sys.argv) > 1 else 'D:/Games/Escape from Tarkov/EscapeFromTarkov_Data'
WORK = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), 'cta-orient-gate')

SRC = open(DUMP, encoding='utf-8').read()
passed = []


def report(title, expect, got, ok):
    passed.append(ok)
    print(f'\n--- {title}')
    print(f'  ожидалось:  {expect}')
    print(f'  получилось: {got}')
    print(f'  {"СОШЛОСЬ" if ok else "НЕ СОШЛОСЬ"}')


def patched_run(tag, edits, args):
    """Боевой dump-terrain.py с точечно изменённым исходником — отдельным процессом,
    чтобы код возврата и судьба файлов были настоящими, а не эмулированными."""
    s = SRC
    for old, new in edits:
        if s.count(old) != 1:
            sys.exit(f'ОТКАЗ: шов «{old[:60]}…» встречается в dump-terrain.py не один раз — '
                     f'проверка разошлась с кодом, чинить надо её, а не обходить')
        s = s.replace(old, new)
    outdir = os.path.join(WORK, tag)
    shutil.rmtree(outdir, ignore_errors=True)
    os.makedirs(outdir, exist_ok=True)
    script = os.path.join(WORK, f'_patched_{tag}.py')
    with open(script, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)
    p = subprocess.run([sys.executable, script] + args, capture_output=True, text=True,
                       encoding='utf-8', errors='replace',
                       env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    return p.returncode, (p.stdout or '') + (p.stderr or ''), outdir


def load_func(name):
    """Функцию берём из боевого файла, а не копируем: копия перестала бы реагировать на правки."""
    tree = ast.parse(SRC, DUMP)
    keep = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom))
            or (isinstance(n, ast.FunctionDef) and n.name == name)]
    if not any(isinstance(n, ast.FunctionDef) for n in keep):
        sys.exit(f'ОТКАЗ: функции {name} в dump-terrain.py нет — проверка разошлась с кодом')
    ns = {}
    exec(compile(ast.Module(body=keep, type_ignores=[]), DUMP, 'exec'), ns)
    return ns[name]


# ============================================================================
# ОПЫТ 3 — децимация res -> alpha. Клиент не нужен: сетка мелкая, ответ выводится вручную.
# Ячейка splat j из aw покрывает долю [j/aw,(j+1)/aw] стороны тайла, центр — (j+0.5)/aw.
# Высоты: res отсчётов с шагом 1/(res-1). При res=9, aw=4 центр ячейки = (j+0.5)*8/4 = 2j+1,
# то есть ЦЕЛЫЕ отсчёты 1,3,5,7 — округление ни при чём, ответ однозначен.
# Ровно эти индексы ломают обе ошибки того класса, ради которого ветка существует:
# потерянные +0.5 дали бы 0,2,4,6, а res вместо res-1 — 1,3,5,8.
# ============================================================================
decimate = load_func('decimate_to_alpha')

res, aw = 9, 4
h = np.add.outer(np.arange(res) * 100, np.arange(res)).astype(np.float32)   # h[r][c] = r*100+c
got = decimate(h, aw, aw)
idx = np.array([1, 3, 5, 7])
want = np.add.outer(idx * 100, idx).astype(np.float64)
bug_no_half = np.add.outer(np.array([0, 2, 4, 6]) * 100, np.array([0, 2, 4, 6]))
bug_res = np.add.outer(np.array([1, 3, 5, 8]) * 100, np.array([1, 3, 5, 8]))
ok = (np.array_equal(got, want) and not np.array_equal(got, bug_no_half)
      and not np.array_equal(got, bug_res))
report('опыт 3: децимация res=9 -> splat 4x4 попадает в центры ячеек',
       f'отсчёты высот {idx.tolist()} по обеим осям, диагональ {np.diag(want).astype(int).tolist()}',
       f'диагональ {np.diag(got).astype(int).tolist()}; без +0.5 вышло бы '
       f'{np.diag(bug_no_half).tolist()}, с res вместо res-1 — {np.diag(bug_res).tolist()}',
       ok)

# Тождество на реальной сетке всех виденных карт: splat 1024 при res 1025 → отсчёт j для ячейки j.
res2, aw2 = 1025, 1024
h2 = np.tile(np.arange(res2, dtype=np.float32), (res2, 1))                   # h[r][c] = c
got2 = decimate(h2, aw2, aw2)
report('опыт 3б: на сетке всех виденных карт (res 1025, splat 1024) децимация вырождается в тождество',
       'столбец ячейки splat j = отсчёт высот j, то есть 0,1,2,…,1023',
       f'первые пять {got2[0][:5].astype(int).tolist()}, последний {int(got2[0][-1])}',
       np.array_equal(got2[0], np.arange(aw2, dtype=np.float64)))

# ============================================================================
# ОПЫТЫ 1 и 2 — на живых данных клиента
# ============================================================================
customs = [f'{EFT}/sharedassets17.assets', f'{EFT}/level17']
inter = [f'{EFT}/sharedassets63.assets', f'{EFT}/level63']
missing = [p for p in customs + inter if not os.path.exists(p)]
if missing:
    print(f'\nПРОПУЩЕНЫ опыты 1-2: нет файлов клиента — '
          f'{", ".join(os.path.basename(m) for m in missing)}')
    print(f'\nитог: сошлось {sum(passed)} из {len(passed)}; опыты на клиенте не прогнаны')
    # провал важнее пропуска: молчать про красный опыт из-за отсутствия клиента нельзя
    sys.exit(2 if all(passed) else 1)

# --- ОПЫТ 1: предикат mirror обязан краснеть на заведомо зеркальном входе ---------------
# Вход переворачивается по Z ПЕРЕД проверкой; сам код проверки не трогается.
# Ожидаемые числа — из постановки таска 05, а не из этого файла: 0.0289 против 0.0636.
MIRROR = [("orient, verdict, orient_axis = orientation_note(a, h, node['name'])",
           "orient, verdict, orient_axis = orientation_note(a[::-1], h, node['name'])")]

code, log, outdir = patched_run('mirror', MIRROR,
                                customs + [os.path.join(WORK, 'mirror'), 'customs'])
line = 'как есть 0.0289 против «зеркало по Z» 0.0636'
bad = os.path.exists(os.path.join(outdir, 'customs-terrain.bin.bad'))
splats = glob.glob(os.path.join(outdir, 'splat_*.bin'))
report('опыт 1: зеркальный по Z splat Таможни роняет прогон',
       f'exit 1, в логе «{line}», выход отложен в customs-terrain.bin.bad, splat-файлов 0',
       f'exit {code}, строка {"найдена" if line in log else "НЕ найдена"}, '
       f'.bad {"есть" if bad else "нет"}, splat-файлов {len(splats)}',
       code == 1 and line in log and bad and not splats)

code, log, outdir = patched_run('mirror-ovr', MIRROR,
                                customs + [os.path.join(WORK, 'mirror-ovr'), 'customs',
                                           'orient-override'])
splats = glob.glob(os.path.join(outdir, 'splat_*.bin'))
report('опыт 1б: тот же вход с пятым аргументом orient-override проходит',
       'exit 0, в логе «отказ снят флагом orient-override», splat-файлов 2',
       f'exit {code}, отметка о снятии отказа '
       f'{"есть" if "отказ снят флагом orient-override" in log else "НЕТ"}, '
       f'splat-файлов {len(splats)}',
       code == 0 and 'отказ снят флагом orient-override' in log and len(splats) == 2)

# --- ОПЫТ 2: фатальный вердикт требует запаса НАД ORIENT_MIN, а не касания ---------------
# Slice_1_1 Развязки — реальный шумовой слайс: как есть -0.0224, зеркало по Z 0.0041.
# При ORIENT_MIN=0.004 он проходит шумовой гейт и упирается уже в фатальный порог
# 0.004 * 1.2 = 0.0048. Балл 0.0041 меньше — значит weak, а не mirror, и прогон живёт.
code, log, outdir = patched_run('lowmin', [('ORIENT_MIN = 0.005', 'ORIENT_MIN = 0.004')],
                                inter + [os.path.join(WORK, 'lowmin'), 'interchange'])
line = 'балл зеркала 0.0041 не обошёл 0.0048'
report('опыт 2: зеркало впереди, но его балл едва над порогом — предупреждение, не отказ',
       f'exit 0, в логе «{line}», вердикта «ЗЕРКАЛО ЛОЖИТСЯ ЛУЧШЕ» нет',
       f'exit {code}, строка {"найдена" if line in log else "НЕ найдена"}, '
       f'фатальный вердикт {"ВЫНЕСЕН" if "ЗЕРКАЛО ЛОЖИТСЯ ЛУЧШЕ" in log else "не вынесен"}',
       code == 0 and line in log and 'ЗЕРКАЛО ЛОЖИТСЯ ЛУЧШЕ' not in log)

shutil.rmtree(WORK, ignore_errors=True)
print(f'\nитог: сошлось {sum(passed)} из {len(passed)}')
if not all(passed):
    sys.exit('ОТКАЗ: шумовой гейт ориентации ведёт себя не так, как задокументировано выше')
