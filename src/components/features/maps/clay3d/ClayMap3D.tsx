'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClayDistrict } from './clay-types';

/**
 * ⚠️ THREE НЕ ИМПОРТИРУЕТСЯ СТАТИЧЕСКИ — только типами.
 *
 * Замер: при статическом импорте three и OrbitControls попадали в чанк САМОЙ
 * страницы, и он вырастал до 7 МБ. Браузер разбирал его так долго, что вкладка
 * подвисала, а проверки состояния регулярно попадали в это окно и давали
 * ложные диагнозы вида «эффект не запускается». Динамический импорт внутри
 * эффекта уводит three в отдельный чанк, который грузится ровно тогда, когда
 * сцена монтируется.
 *
 * Побочно это закрывает и правило §4.6: на сервере не исполняется ничего от
 * three, потому что эффектов на сервере нет. Посредник next/dynamic не нужен.
 */
import type * as THREE_T from 'three';

/** Цвет из токена NIGHTFALL: литеральных HEX в сцене нет (§6). */
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function ClayMap3D({ base }: { base: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [floors, setFloors] = useState<{ name: string; level: number }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<'load' | 'ok' | 'fail'>('load');
  /** Текст ошибки прямо в кадре: молчаливый сбой неотличим от «ещё грузится». */
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<
    { tris: number; calls: number; dist: number; span: string } | null
  >(null);
  /** Смена этажа не должна пересобирать сцену — материалы меняем императивно. */
  const applyFloorRef = useRef<((name: string) => void) | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      try {
        // Три модуля разом: three, контролы и наши построители геометрии.
        // Построители держат статический импорт three у себя, поэтому все они
        // уезжают в один общий отложенный чанк.
        const [THREE, { OrbitControls }, BGU, geom] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/utils/BufferGeometryUtils.js'),
          import('./clay-geometry'),
        ]);
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(token('--color-base', '#141416'));

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        // Токены NIGHTFALL почти чёрные (#141416…#54545C). Без тональной
        // компрессии их разница схлопывается в один тон, а поднимать сами
        // цвета нельзя — они канон. ACES растягивает тени, сохраняя палитру.
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // Экспозиция подобрана ЖИВЬЁМ: при 1.35 поверхности схлопывались в
        // чёрное и в кадре оставались одни рёбра. Токены поднимать нельзя —
        // они канон, поэтому тянем экспозицию.
        renderer.toneMappingExposure = 2.6;
        // Тени дают глубину, без них объёмы читаются плоскими.
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Кап плотности пикселей: на телефоне DPR доходит до 3–4, и честный
        // рендер в такое разрешение съедает кадр без видимой разницы на
        // клэй-поверхностях, где нет ни текстур, ни мелкого контраста.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(host.clientWidth, host.clientHeight);
        host.appendChild(renderer.domElement);

        // ПЕРСПЕКТИВА (решение V4DYA после живого просмотра орто-изометрии).
        // Орто читалась как чертёж, но кадр вышел «мёртвым»: без схождения
        // линий район не ощущается объёмом. 40° — компромисс: шире даёт
        // заметное искажение по краям, уже — приближается к орто.
        const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 6000);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2.05;

        // Свет подобран под ПОЧТИ ЧЁРНЫЕ токены NIGHTFALL: корпус здания это
        // #313135, и при «нормальных» интенсивностях сцена уходит в чёрный
        // прямоугольник. В Blender-превью та же история решалась так же —
        // поднятым ambient. Контровой сзади отделяет силуэт от фона.
        scene.add(new THREE.AmbientLight(0xffffff, 2.1));
        const key = new THREE.DirectionalLight(0xffffff, 2.6);
        key.position.set(-90, 140, 70);
        key.castShadow = true;
        scene.add(key);
        // Контровой сзади отделяет силуэт от фона, тени не бросает.
        const rim = new THREE.DirectionalLight(0xffffff, 0.9);
        rim.position.set(80, 60, -90);
        scene.add(rim);

        // ТРИ РОЛИ — ТРИ СТУПЕНИ СВЕТЛОТЫ, все из токенов (§6):
        //   плита пола   card-menu  #242426  — тёмное основание
        //   стены        lines-hover #313135 — корпус
        //   конструкции  text-muted #54545C  — то, ради чего берутся меши
        // Раньше все три были в одном тоне и сливались.
        const solid = new THREE.Color(token('--color-lines-hover', '#313135'));
        const matSolid = new THREE.MeshLambertMaterial({ color: solid });
        const matPlate = new THREE.MeshLambertMaterial({
          color: new THREE.Color(token('--color-card-menu', '#242426')),
        });
        const edgeCol = new THREE.Color(token('--color-text-muted', '#54545C'));
        const matEdge = new THREE.LineBasicMaterial({
          color: edgeCol, transparent: true, opacity: 0.55,
        });
        // Рентген (решение V4DYA): стены полупрозрачные, пол ПЛОТНЫЙ. Сплошное
        // стекло превращает здание в аквариум, где не читаются уровни.
        const matXray = new THREE.MeshLambertMaterial({
          color: solid, transparent: true, opacity: 0.2, depthWrite: false,
        });

        const res = await fetch(`${base}/district-dorms.json`);
        if (!res.ok) throw new Error(`геометрия района: HTTP ${res.status}`);
        const doc = (await res.json()) as ClayDistrict;
        if (disposed) return;


        // Контуры граней: в Blender их рисовал Freestyle, и именно они делали
        // планировку читаемой. В вебе рисуем geometry-рёбрами.
        // ⚠️ Геометрия НЕиндексированная (ради плоских нормалей), и EdgesGeometry
        // на ней выдала бы каркас по КАЖДОМУ треугольнику. Поэтому перед
        // выделением рёбер вершины сшиваются mergeVertices — иначе вместо
        // контура получается сетка.
        const edgesOf = (g: THREE_T.BufferGeometry) =>
          new THREE.EdgesGeometry(BGU.mergeVertices(g, 1e-4), 24);

        const wallMeshes = new Map<string, THREE_T.Mesh>();
        const edgeLines = new Map<string, THREE_T.LineSegments>();
        for (const b of geom.buildFloors(doc.floors)) {
          if (b.plate) {
            const m = new THREE.Mesh(b.plate, matPlate);
            m.name = `plate:${b.floor.name}`;
            m.receiveShadow = true;
            scene.add(m);
          }
          if (b.walls) {
            const m = new THREE.Mesh(b.walls, matSolid);
            m.name = `walls:${b.floor.name}`;
            m.castShadow = true;
            m.receiveShadow = true;
            scene.add(m);
            wallMeshes.set(b.floor.name, m);

            const l = new THREE.LineSegments(edgesOf(b.walls), matEdge);
            l.name = `edges:${b.floor.name}`;
            scene.add(l);
            edgeLines.set(b.floor.name, l);
          }
        }

        if (doc.stairs) {
          const binRes = await fetch(`${base}/${doc.stairs.bin}`);
          if (!binRes.ok) throw new Error(`лестницы: HTTP ${binRes.status}`);
          const bin = await binRes.arrayBuffer();
          if (disposed) return;
          for (const mesh of geom.buildStairs(doc.stairs, bin)) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
          }
        }

        applyFloorRef.current = (name: string) => {
          for (const [fname, mesh] of wallMeshes) {
            mesh.material = fname === name ? matSolid : matXray;
          }
          // Контуры призрачных этажей приглушаем, иначе рёбра всех уровней
          // накладываются и планировка активного этажа тонет в сетке.
          for (const [fname, line] of edgeLines) {
            line.visible = fname === name;
          }
        };

        const list = doc.floors.map((f) => ({ name: f.name, level: f.level }));
        const start = list.find((f) => f.level === 0) ?? list[0];
        if (start) applyFloorRef.current(start.name);

        // Посадка камеры по РЕАЛЬНОМУ габариту собранной сцены, а не по рамке
        // района: плита строится из контуров комнат, а комната, чей центроид
        // попал в рамку, может выходить за неё — от рамки камера садилась
        // внутрь застройки.
        const box = new THREE.Box3();
        scene.traverse((o) => {
          const mesh = o as THREE_T.Mesh;
          if (mesh.geometry) box.expandByObject(mesh);
        });
        const size = box.getSize(new THREE.Vector3());
        const mid = box.getCenter(new THREE.Vector3());
        const reach = Math.max(size.x, size.z, 1);

        // Отступ считаем от габарита и угла обзора, а не подбираем на глаз:
        // половина сцены должна укладываться в половину поля зрения, плюс
        // запас на поля. По вертикали кадр уже, поэтому берём худший случай.
        const fitDistance = () => {
          const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
          const vFov = (camera.fov * Math.PI) / 180;
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
          const needV = (size.z * 0.5 + size.y * 0.5) / Math.tan(vFov / 2);
          const needH = size.x * 0.5 / Math.tan(hFov / 2);
          return Math.max(needV, needH) * 1.25;
        };

        // 🔴 ПЛОСКОСТЬ ЗЕМЛИ. Без неё здания висят в пустоте, и при изометрии
        // глазу не за что зацепиться: расстановка корпусов на разной глубине
        // читается как НАКЛОН пола, хотя данные идеально плоские (плита каждого
        // этажа строится на постоянной отметке z0). В Blender-превью земля
        // была, поэтому там дефекта не возникало. Она же принимает тени и
        // задаёт горизонт.
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(reach * 2.4, reach * 2.4),
          new THREE.MeshLambertMaterial({
            color: new THREE.Color(token('--color-base', '#141416')),
          }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(mid.x, -0.3, mid.z);
        ground.receiveShadow = true;
        ground.name = 'ground';
        scene.add(ground);

        // Направление взгляда: азимут 45°, подъём ~34°. Угол оставлен от
        // изометрии — вопрос был к проекции, а не к тому, откуда смотрим.
        const dir = new THREE.Vector3(-1, 0.78, 1).normalize();
        const dist = fitDistance();
        controls.target.set(mid.x, Math.min(mid.y, 6), mid.z);
        camera.position.copy(controls.target).addScaledVector(dir, dist);
        camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
        camera.near = Math.max(dist * 0.02, 0.5);
        camera.far = dist * 6;
        camera.updateProjectionMatrix();
        controls.minDistance = reach * 0.12;
        controls.maxDistance = dist * 2.5;
        controls.update();

        // Тень от основного света: у направленного источника камера теней тоже
        // ортографическая, и её надо растянуть на весь район, иначе тени
        // обрываются по невидимой границе.
        const sc = key.shadow.camera as THREE_T.OrthographicCamera;
        sc.left = -reach * 0.8;
        sc.right = reach * 0.8;
        sc.top = reach * 0.8;
        sc.bottom = -reach * 0.8;
        sc.near = 0.5;
        sc.far = reach * 4;
        sc.updateProjectionMatrix();
        key.shadow.mapSize.set(2048, 2048);
        key.position.set(mid.x - reach * 0.9, reach * 1.4, mid.z + reach * 0.7);
        key.target.position.copy(controls.target);
        scene.add(key.target);


        const onResize = () => {
          if (!host.clientWidth || !host.clientHeight) return;
          camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight);
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(host);

        let frame = 0;
        let ticks = 0;
        const loop = () => {
          frame = requestAnimationFrame(loop);
          controls.update();
          renderer.render(scene, camera);
          // Счётчик снимается один раз: это приёмка бюджета, а не постоянный HUD.
          if (++ticks === 30) {
            setStats({
              tris: renderer.info.render.triangles,
              calls: renderer.info.render.calls,
              // Числа камеры в приёмку: «кадр не тот» без них лечится гаданием.
              dist: Math.round(camera.position.distanceTo(controls.target)),
              span: `${Math.round(size.x)}×${Math.round(size.y)}×${Math.round(size.z)}`,
            });
          }
        };
        loop();

        cleanup = () => {
          cancelAnimationFrame(frame);
          ro.disconnect();
          controls.dispose();
          scene.traverse((o) => {
            const mesh = o as THREE_T.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
          });
          matSolid.dispose();
          matPlate.dispose();
          matXray.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };

        setFloors(list);
        if (start) setActive(start.name);
        setStatus('ok');
      } catch (e) {
        // Стек в кадре: консоль в этой связке оказалась ненадёжной, а место
        // падения нужно знать точно — сообщение без него уже увело в сторону.
        const stack = e instanceof Error && e.stack
          ? e.stack.split(String.fromCharCode(10)).slice(0, 4).join(' ← ')
          : '';
        const msg = e instanceof Error ? `${e.name}: ${e.message} | ${stack}` : String(e);
        console.error('[clay3d] сцена не собралась', e);
        if (!disposed) {
          setErr(msg);
          setStatus('fail');
        }
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [base]);

  const pick = (name: string) => {
    setActive(name);
    applyFloorRef.current?.(name);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />

      {status === 'load' && (
        <div className="absolute inset-0 animate-pulse bg-linear-to-br from-card-menu to-(--color-base)" />
      )}
      {status === 'fail' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="max-w-lg px-6 text-center font-blender-book text-sm text-danger">
            Сцена не собралась{err ? `: ${err}` : ''}
          </p>
        </div>
      )}

      {floors.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Этаж
          </span>
          {[...floors].reverse().map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => pick(f.name)}
              className={`h-8 w-28 border font-blender-medium text-xs uppercase tracking-widest transition-colors ${
                active === f.name
                  ? 'border-(--primary) text-(--primary)'
                  : 'border-lines-hover text-text-muted hover:border-(--primary)'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {stats && (
        <div className="absolute right-4 bottom-4 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          {stats.tris.toLocaleString('ru-RU')} tri · {stats.calls} вызовов ·
          {' '}сцена {stats.span} м · камера {stats.dist} м
        </div>
      )}
    </div>
  );
}
