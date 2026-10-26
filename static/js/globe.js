(() => {
  'use strict';
  const canvas = document.getElementById('earth-canvas');
  if (!canvas || !window.THREE) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) { canvas.hidden = true; return; }
  document.body.prepend(canvas);
  canvas.classList.add('space-canvas');
  document.documentElement.classList.add('has-webgl');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const CAM_Z = 3.65, TAN = Math.tan(17 * Math.PI / 180);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  camera.position.z = CAM_Z;
  let vw = 1, vh = 1;
  // screen pixel -> world position on the plane at depth z; pixel radius -> world radius
  const place = (obj, sx, sy, z, rpx) => {
    const half = TAN * (CAM_Z - z);
    obj.position.set((sx / vw * 2 - 1) * half * (vw / vh), -(sy / vh * 2 - 1) * half, z);
    obj.scale.setScalar(rpx * 2 * half / vh);
  };

  // ---------- procedural textures ----------
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const moonTex = tex(256, 128, (g, w, h) => { g.fillStyle = '#8c8a86'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 9; g.fillStyle = `rgba(${rnd() < .5 ? '60,58,56' : '170,168,162'},.35)`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
  const marsTex = tex(256, 128, (g, w, h) => { g.fillStyle = '#b4532a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '120,50,25' : '220,140,90'},.3)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 26, 3 + rnd() * 10, 0, 0, 7); g.fill(); } g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, 0, w, 5); });
  const bandTex = (cols) => tex(64, 256, (g, w, h) => { for (let y = 0; y < h; y++) { g.fillStyle = cols[Math.floor((Math.sin(y * .21) * .5 + .5) * .6 * cols.length + rnd() * .4 * cols.length) % cols.length]; g.fillRect(0, y, w, 1); } });

  // ---------- system: earth + everything orbiting it ----------
  const sys = new THREE.Group(); scene.add(sys);
  const earthGroup = new THREE.Group();
  earthGroup.rotation.set(.08, -1.95, -.08);
  sys.add(earthGroup);
  const texture = new THREE.TextureLoader().load('/static/assets/earth-blue-marble.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.MeshStandardMaterial({ map: texture, roughness: .86, metalness: .05, color: 0x9eabb0 })));
  sys.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 64), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vNormal; void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vNormal; void main(){float i=pow(0.62-dot(vNormal,vec3(0.,0.,1.)),3.0);gl_FragColor=vec4(1.0,.28,.06,1.0)*i;}',
    blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true })));

  // lat/lon -> point on the sphere, matching three.js SphereGeometry UV mapping (lon 0 on +x)
  const coordinate = (lat, lon, r = 1) => { const p = lat * Math.PI / 180, t = lon * Math.PI / 180; return new THREE.Vector3(r * Math.cos(p) * Math.cos(t), r * Math.sin(p), -r * Math.cos(p) * Math.sin(t)); };

  // country borders from the world GeoJSON (echarts "UTF8Encoding" format or plain GeoJSON)
  let bordersBuilt = false;
  function decodeRing(ring, off, scale) {
    if (typeof ring !== 'string') return ring;
    let px = off[0], py = off[1]; const out = [];
    for (let i = 0; i < ring.length; i += 2) {
      let x = ring.charCodeAt(i) - 64, y = ring.charCodeAt(i + 1) - 64;
      x = (x >> 1) ^ (-(x & 1)); y = (y >> 1) ^ (-(y & 1));
      px += x; py += y; out.push([px / scale, py / scale]);
    }
    return out;
  }
  function buildBorders() {
    const geo = window.__WORLD_GEO;
    if (bordersBuilt || !geo || !geo.features) return;
    bordersBuilt = true;
    const scale = geo.UTF8Scale || 1024, pts = [];
    const addRing = (ring) => {
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        if (Math.abs(a[0] - b[0]) > 180) continue;
        pts.push(coordinate(a[1], a[0], 1.003), coordinate(b[1], b[0], 1.003));
      }
    };
    geo.features.forEach((f) => {
      const g = f.geometry; if (!g) return;
      const enc = g.encodeOffsets;
      if (g.type === 'Polygon') g.coordinates.forEach((r, i) => addRing(decodeRing(r, enc ? enc[i] : null, scale)));
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly, i) => poly.forEach((r, j) => addRing(decodeRing(r, enc ? enc[i][j] : null, scale))));
    });
    earthGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff9a52, transparent: true, opacity: .62 })));
    render();
  }

  const nairobi = coordinate(-1.2921, 36.8219, 1.012);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.018, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
  marker.position.copy(nairobi); earthGroup.add(marker);
  const halo = new THREE.Mesh(new THREE.RingGeometry(.025, .04, 32), new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: .8, side: THREE.DoubleSide }));
  halo.position.copy(nairobi); halo.lookAt(nairobi.clone().multiplyScalar(2)); earthGroup.add(halo);

  // ---------- orbiters ----------
  const orbiters = [];
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .5, metalness: .6 }, o));
  function satellite(kind) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .045), mat(0xd9d4c7));
    const panelM = mat(0x1d3b6e, { emissive: 0x0b1a33, side: THREE.DoubleSide });
    const span = kind === 'iss' ? .09 : .06;
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(span, .0015, .026), panelM); p.position.x = s * (.02 + span / 2); g.add(p); });
    if (kind === 'iss') { const truss = new THREE.Mesh(new THREE.BoxGeometry(.2, .004, .004), mat(0xbbbbbb)); g.add(truss); body.scale.set(1.3, 1.3, 1.6); }
    g.add(body); g.scale.setScalar(.75);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.008, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff6600 })); beacon.position.y = .022; g.add(beacon);
    return g;
  }
  function addOrbit(def) {
    const pivot = new THREE.Group(); pivot.rotation.set(def.tilt, def.node, 0); sys.add(pivot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(def.r, .0012, 4, 220), new THREE.MeshBasicMaterial({ color: def.ring || 0x8a8a8a, transparent: true, opacity: def.op || .3 }));
    ring.rotation.x = Math.PI / 2; pivot.add(ring);
    const arm = new THREE.Group(); pivot.add(arm);
    arm.add(def.body); def.body.position.x = def.r;
    orbiters.push({ arm, speed: def.speed, phase: def.phase, body: def.body, spin: def.spin });
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(.27, 40, 40), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 }));
  addOrbit({ r: 2.35, tilt: .2, node: .4, speed: .045, phase: 1.2, body: moon, ring: 0xaaaaaa, op: .2, spin: .05 });
  addOrbit({ r: 1.2, tilt: .15, node: 2.2, speed: .32, phase: 0, body: satellite('iss'), ring: 0xff6600, op: .38 });
  addOrbit({ r: 1.34, tilt: 1.05, node: .3, speed: -.24, phase: 2, body: satellite(), ring: 0x888888, op: .3 });
  addOrbit({ r: 1.34, tilt: 1.05, node: .3, speed: -.24, phase: 5.2, body: satellite(), ring: 0x888888, op: 0 });
  addOrbit({ r: 1.55, tilt: 1.45, node: 1.4, speed: .17, phase: 3.3, body: satellite(), ring: 0x888888, op: .26 });
  addOrbit({ r: 1.55, tilt: 1.45, node: 1.4, speed: .17, phase: 0.4, body: satellite(), ring: 0x888888, op: 0 });
  addOrbit({ r: 1.78, tilt: .72, node: 4.1, speed: .11, phase: 4.4, body: satellite(), ring: 0xff6600, op: .2 });
  // debris / dust belt around low earth orbit
  const belt = new THREE.Points((() => { const a = []; for (let i = 0; i < 700; i++) { const r = 1.42 + rnd() * .14, t = rnd() * 6.283; a.push(Math.cos(t) * r, (rnd() - .5) * .05, Math.sin(t) * r); } return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); })(), new THREE.PointsMaterial({ color: 0xcfc8bb, size: .008, transparent: true, opacity: .55, sizeAttenuation: true }));
  belt.rotation.set(.35, 0, -.25); sys.add(belt);

  scene.add(new THREE.AmbientLight(0x73838c, 1.25));
  const key = new THREE.DirectionalLight(0xf3eee5, 3.1); key.position.set(-3, 2, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff6600, 2.2); rim.position.set(3, -1, -2); scene.add(rim);

  // ---------- distant planets (deep parallax) ----------
  const planets = [];
  function planet(map, u, page, depth, rpx, speed, ring) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), new THREE.MeshStandardMaterial({ map, roughness: .95, metalness: 0 }));
    const g = new THREE.Group(); g.add(m);
    if (ring) { const r = new THREE.Mesh(new THREE.RingGeometry(1.35, 2.1, 80), new THREE.MeshBasicMaterial({ color: 0xcdb98a, transparent: true, opacity: .5, side: THREE.DoubleSide })); r.rotation.x = 1.25; g.add(r); }
    g.rotation.z = .3; scene.add(g);
    planets.push({ g, m, u, page, depth, rpx, speed });
  }
  planet(marsTex, .95, 1.5, -4, 40, .55);
  planet(bandTex(['#c9a27a', '#e3c9a2', '#a97c55', '#d8b48a']), .9, 2.6, -6, 70, .45);
  planet(bandTex(['#d9c48f', '#efe0b2', '#bfa56f']), .55, 4.15, -5, 46, .5, true);
  planet(bandTex(['#4a6fa5', '#5f86c0', '#3d5d8e']), .94, 5.0, -7, 36, .4);

  // ---------- fixed layered starfield (CSS, scroll parallax) ----------
  const field = document.createElement('div'); field.className = 'starfield'; field.setAttribute('aria-hidden', 'true');
  const tile = (n, size, a) => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,${230 + rnd() * 25 | 0},${210 + rnd() * 45 | 0},${a * (.4 + rnd() * .6)})`; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, size * (.5 + rnd() * .7), 0, 7); g.fill(); } return `url(${c.toDataURL()})`; };
  const layers = [[.04, tile(110, 1.2, .8)], [.09, tile(55, 1.7, .9)], [.16, tile(22, 2.3, 1)]];
  field.style.backgroundImage = layers.map((l) => l[1]).join(',');
  document.body.prepend(field);

  // ---------- layout + scroll ----------
  let anchor = { x: 0, y: 0, r: 100 }, workTop = 1;
  const wrap = document.querySelector('.globe-wrap');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    if (wrap) { const r = wrap.getBoundingClientRect(); anchor = { x: r.left + r.width / 2, y: r.top + window.scrollY + r.height / 2, r: Math.min(r.width, r.height) * .45 }; }
    const w = document.getElementById('work'); workTop = w ? w.getBoundingClientRect().top + window.scrollY : vh * 1.6;
    render();
  }
  let sp = 0, lastScroll = 0, spin = 0, pointerX = 0, pointerY = 0, tX = 0, tY = 0;
  window.addEventListener('pointermove', (e) => { if (reduceMotion) return; tY = (e.clientX / vw - .5) * .16; tX = (e.clientY / vh - .5) * .08; }, { passive: true });
  function render(time = 0) {
    const t = time * .001, y = window.scrollY;
    sp += (clamp(y / Math.max(1, workTop - vh * .15)) - sp) * (reduceMotion ? 1 : .1);
    const e = ease(sp), mobile = vw < 768;
    const fx = mobile ? vw * .5 : vw * .78, fy = vh * (mobile ? .72 : .6), fr = Math.min(vw, vh) * (mobile ? .17 : .2);
    const baseY = anchor.y - y * .62;                 // slower than content => parallax lag
    const sx = anchor.x + (fx - anchor.x) * e;
    const sy = baseY + (fy - baseY) * e - Math.max(0, y - workTop) * .06;
    place(sys, sx, sy, 0, anchor.r + (fr - anchor.r) * e);
    canvas.style.opacity = String(1 - .5 * e);
    spin += (y - lastScroll) * .0016; lastScroll = y;
    earthGroup.rotation.y = -1.95 + spin + t * .045 * (reduceMotion ? 0 : 1) + (tY - 0) * 1.4;
    earthGroup.rotation.x = .08 + tX * .8;
    halo.scale.setScalar(1 + (reduceMotion ? 0 : (Math.sin(t * 2.4) * .5 + .5) * .6));
    orbiters.forEach((o) => { o.arm.rotation.y = o.phase + (reduceMotion ? 0 : t * o.speed) + y * .0006 * Math.sign(o.speed); if (o.spin) o.body.rotation.y = t * o.spin; else o.body.rotation.y = -o.arm.rotation.y; });
    belt.rotation.y = t * .02 + y * .0004;
    sys.rotation.z = e * .18;
    planets.forEach((p) => {
      const py = p.page * vh - y * p.speed;
      place(p.g, p.u * vw + Math.sin(y * .0006 + p.page) * 14, py, p.depth, p.rpx);
      p.m.rotation.y = reduceMotion ? 0 : t * .05; p.g.visible = py > -200 && py < vh + 200;
    });
    field.style.backgroundPosition = layers.map((l) => `0 ${-y * l[0]}px`).join(',');
    renderer.render(scene, camera);
  }
  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  function loop(time) { requestAnimationFrame(loop); if (visible) render(time); }
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('scroll', () => { if (reduceMotion) render(performance.now()); }, { passive: true });
  window.addEventListener('load', () => { buildBorders(); measure(); });
  buildBorders(); measure();
  if (reduceMotion) render(0); else requestAnimationFrame(loop);
})();
