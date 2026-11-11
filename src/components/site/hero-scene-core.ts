import * as THREE from 'three'

// =====================================================
// Hero scena: noćni aerodrom (Three.js, bez ijednog eksternog asseta).
// Sve je proceduralno: pista sa svjetlima koja "klize" prema kameri,
// wireframe hologram putničkog aviona sa navigacionim svjetlima, HUD
// prstenovi, GSE vozila sa amber rotacionim svjetlima i silueta planina
// iznad zaliva. Palete su iste kao na ostatku stranice (tarmac/amber/taxiway).
//
// Pravila za performanse (radnici koriste telefone i tablete):
//  - pixelRatio je ograničen, na slabijim uređajima 30 FPS,
//  - petlja stane kad hero nije vidljiv ili je tab skriven,
//  - prefers-reduced-motion: renderuje se jedan statičan kadar,
//  - adaptivna rezolucija: ako je prosječan frame spor, spusti se pixelRatio.
// =====================================================

export interface HeroSceneOptions {
  reducedMotion: boolean
  /** telefon / slabiji uređaj: manje svjetala, 30 FPS, pixelRatio 1 */
  compact: boolean
  onReady?: () => void
}

export interface HeroSceneHandle {
  start(): void
  stop(): void
  dispose(): void
}

const AMBER = 0xf2a516
const ICE = 0x7fc4ff
const FOG = 0x120e09
const LOOP = 360 // dužina "kružnog" niza svjetala duž piste
const SPEED = 15 // jedinica/s — brzina kojom se svjetla približavaju kameri

function rgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

// ---------- tekstura sjaja (za sprajtove: navigaciona svjetla, rotacije) ----------
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------- svjetla kao Points sa vlastitim shaderom ----------
const LIGHT_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPulse;
uniform float uTime, uSpeed, uLoop, uScale, uFar, uAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float z = mod(position.z + uTime * uSpeed, uLoop) - uLoop + 18.0;
  vec4 mv = modelViewMatrix * vec4(position.x, position.y, z, 1.0);
  float d = -mv.z;
  float pulse = aPulse * pow(0.5 + 0.5 * sin(d * 0.085 - uTime * 5.0), 9.0);
  vAlpha = (0.9 + pulse * 1.8) * smoothstep(uFar, uFar * 0.45, d) * smoothstep(0.6, 3.5, d) * uAlpha;
  vColor = aColor;
  gl_PointSize = clamp(aSize * 1.9 * (1.0 + pulse * 0.9) * uScale / max(d, 0.1), 2.2, 64.0);
  gl_Position = projectionMatrix * mv;
}`
const LIGHT_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 11.0);
  float halo = exp(-r * r * 2.8) * 0.5;
  vec3 col = mix(vColor, vec3(1.0), core * 0.55) * (core * 1.5 + halo);
  gl_FragColor = vec4(col, vAlpha);
}`

function lightMaterial(speed: number, alpha: number, far: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: LIGHT_VERT,
    fragmentShader: LIGHT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uLoop: { value: LOOP },
      uScale: { value: 600 },
      uFar: { value: far },
      uAlpha: { value: alpha },
    },
  })
}

interface LightBuf { pos: number[]; col: number[]; size: number[]; pulse: number[] }
function lightGeometry(b: LightBuf): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(b.col, 3))
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(b.size, 1))
  g.setAttribute('aPulse', new THREE.Float32BufferAttribute(b.pulse, 1))
  return g
}

// ---------- hologram: ispuna + ivice ----------
function holo(geo: THREE.BufferGeometry, edge: number, threshold = 20, edgeOpacity = 0.9): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x0a1118, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  })))
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, threshold),
    new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: edgeOpacity }),
  ))
  return g
}

function loopLine(radius: number, z: number, color: number, seg = 14, opacity = 0.55): THREE.LineLoop {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z))
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  )
}

/** Putnički avion (uskotrupni, dva motora), nos prema -Z, gleda se otpozadi. */
function buildAircraft(): THREE.Group {
  const plane = new THREE.Group()

  const fus = new THREE.CylinderGeometry(0.95, 0.95, 11, 14, 1, true)
  fus.rotateX(Math.PI / 2)
  plane.add(holo(fus, ICE, 15))
  for (let i = 0; i <= 10; i++) plane.add(loopLine(0.95, -5.5 + i * 1.1, ICE, 14, 0.4))

  const nose = new THREE.ConeGeometry(0.95, 3, 14)
  nose.rotateX(-Math.PI / 2)
  nose.translate(0, 0, -7)
  plane.add(holo(nose, ICE, 15))
  const tail = new THREE.ConeGeometry(0.95, 3.8, 14)
  tail.rotateX(Math.PI / 2)
  tail.translate(0, 0.25, 7.4)
  plane.add(holo(tail, ICE, 15))

  // krila (desno + ogledalo)
  const wing = new THREE.Shape()
  wing.moveTo(0.8, -1.6); wing.lineTo(6.1, 1.3); wing.lineTo(6.1, 2.3); wing.lineTo(0.8, 1.9); wing.closePath()
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.12, bevelEnabled: false })
  wingGeo.rotateX(Math.PI / 2)
  wingGeo.translate(0, -0.45, 0.3)
  const wr = holo(wingGeo, ICE)
  const wl = holo(wingGeo.clone(), ICE)
  wl.scale.x = -1
  plane.add(wr, wl)

  // horizontalni stabilizatori
  const stab = new THREE.Shape()
  stab.moveTo(0.5, 0); stab.lineTo(2.9, 1.2); stab.lineTo(2.9, 1.9); stab.lineTo(0.5, 1.6); stab.closePath()
  const stabGeo = new THREE.ExtrudeGeometry(stab, { depth: 0.08, bevelEnabled: false })
  stabGeo.rotateX(Math.PI / 2)
  stabGeo.translate(0, 0.25, 5.2)
  const sr = holo(stabGeo, ICE)
  const sl = holo(stabGeo.clone(), ICE)
  sl.scale.x = -1
  plane.add(sr, sl)

  // vertikalni stabilizator (oblik je u XY ravni, ekstruzija po Z pa zarotiran oko Y)
  const fin = new THREE.Shape()
  fin.moveTo(-0.0, 0); fin.lineTo(-2.4, 0); fin.lineTo(-4.0, 3.6); fin.lineTo(-3.0, 3.6); fin.closePath()
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false })
  finGeo.translate(0, 0, -0.05)
  finGeo.rotateY(Math.PI / 2) // sx -> -z : prije rotacije sx je negativno, pa postaje +z
  finGeo.translate(0, 0.7, 3.4)
  plane.add(holo(finGeo, ICE))

  // motori
  for (const side of [-1, 1]) {
    const eng = new THREE.CylinderGeometry(0.58, 0.5, 2.4, 12, 1, true)
    eng.rotateX(Math.PI / 2)
    eng.translate(side * 2.7, -1.0, -0.4)
    plane.add(holo(eng, ICE, 15))
    const lip = loopLine(0.58, -1.6, AMBER, 12, 0.85)
    lip.position.set(side * 2.7, -1.0, 0)
    plane.add(lip)
  }
  return plane
}

/** Vozilo (vučni traktor / GPU) — wireframe sa rotacionim svjetlom. */
function buildVehicle(glow: THREE.Texture): { group: THREE.Group; beacon: THREE.Sprite } {
  const g = new THREE.Group()
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    geo.translate(x, y, z)
    g.add(holo(geo, AMBER, 20, 0.85))
  }
  box(2.2, 1.0, 4.4, 0, 0.95, 0.4)
  box(1.9, 1.0, 1.7, 0, 1.95, -0.9)
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.9]) {
    const w = new THREE.CylinderGeometry(0.52, 0.52, 0.4, 12)
    w.rotateZ(Math.PI / 2)
    w.translate(sx * 1.15, 0.52, sz)
    g.add(holo(w, AMBER, 25, 0.7))
  }
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow, color: AMBER, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  beacon.scale.set(4.2, 4.2, 1)
  beacon.position.set(0, 2.95, -0.9)
  g.add(beacon)
  return { group: g, beacon }
}

/** Silueta planina (zaliv). Boje idu od "magle" na dnu ka tamnoj na vrhu. */
function buildRidge(seed: number, zPos: number, peak: number, top: number, bottom: number, rimOpacity: number): THREE.Group {
  const grp = new THREE.Group()
  const shape = new THREE.Shape()
  const pts: number[] = []
  const xs: number[] = []
  for (let x = -900; x <= 900; x += 18) xs.push(x)
  shape.moveTo(xs[0], -20)
  const ridgePts: THREE.Vector3[] = []
  for (const x of xs) {
    const h = peak * (0.55 + 0.3 * Math.sin(x * 0.0078 + seed) + 0.18 * Math.sin(x * 0.021 + seed * 2.3) + 0.08 * Math.sin(x * 0.063 + seed * 5.1))
    shape.lineTo(x, h)
    ridgePts.push(new THREE.Vector3(x, h, 0.2))
    pts.push(h)
  }
  shape.lineTo(xs[xs.length - 1], -20)
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape)
  const pos = geo.getAttribute('position')
  const cols: number[] = []
  const cTop = new THREE.Color(top), cBot = new THREE.Color(bottom), tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + 20) / (peak + 20), 0, 1)
    tmp.copy(cBot).lerp(cTop, Math.pow(t, 0.7))
    cols.push(tmp.r, tmp.g, tmp.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false })))
  grp.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ridgePts),
    new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: rimOpacity, fog: false }),
  ))
  grp.position.z = zPos
  return grp
}

export function createHeroScene(canvas: HTMLCanvasElement, opts: HeroSceneOptions): HeroSceneHandle {
  const { compact, reducedMotion } = opts
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !compact, alpha: false,
    powerPreference: compact ? 'low-power' : 'high-performance',
  })
  let pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.75)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(FOG, 1)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(FOG, 70, 340)
  const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 1400)
  const CAM_BASE = new THREE.Vector3(0, 11, 14)
  const LOOK = new THREE.Vector3(0, -1.3, -46) // pogled s povišene tačke (toranj), horizont u gornjoj četvrtini
  camera.position.copy(CAM_BASE)
  camera.lookAt(LOOK)

  const glow = glowTexture()
  const disposables: { dispose(): void }[] = [glow]
  const lightMats: THREE.ShaderMaterial[] = []

  // ---- nebo (gradijent po smjeru + sjaj aerodroma na horizontu) ----
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir;
        void main(){
          float y = max(vDir.y, 0.0);
          vec3 zenith = vec3(0.012, 0.022, 0.045);
          vec3 mid = vec3(0.035, 0.050, 0.078);
          vec3 hor = vec3(0.105, 0.075, 0.040);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, y));
          c = mix(c, zenith, smoothstep(0.12, 0.7, y));
          float g = pow(max(dot(normalize(vDir.xz), vec2(0.0, -1.0)), 0.0), 6.0) * exp(-y * 22.0);
          c += vec3(0.38, 0.22, 0.04) * g * 0.35;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  sky.renderOrder = -30
  sky.frustumCulled = false
  scene.add(sky)
  disposables.push(sky.geometry, sky.material as THREE.Material)

  // ---- zvijezde ----
  {
    const n = compact ? 220 : 520
    const p: number[] = [], s: number[] = [], ph: number[] = []
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = 0.04 + Math.random() * 0.96
      const th = u * Math.PI * 2, r = Math.sqrt(1 - v * v)
      p.push(Math.cos(th) * r * 650, v * 650, Math.sin(th) * r * 650 - 100)
      s.push(1.0 + Math.random() * 1.8)
      ph.push(Math.random() * 6.28)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(s, 1))
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1))
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uPx: { value: pixelRatio } },
      vertexShader: `attribute float aSize; attribute float aPhase; uniform float uTime, uPx; varying float vA;
        void main(){ vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + aPhase)); gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor = vec4(vec3(0.75,0.85,1.0), vA*(1.0-r)); }',
    })
    const stars = new THREE.Points(g, m)
    stars.frustumCulled = false
    stars.renderOrder = -25
    scene.add(stars)
    disposables.push(g, m)
    scene.userData.starMat = m
  }

  // ---- planine ----
  const ridgeBack = buildRidge(1.3, -470, 95, 0x0c1218, 0x1a1209, 0.0)
  const ridgeFront = buildRidge(4.1, -420, 62, 0x080c10, 0x17110a, 0.32)
  ridgeBack.renderOrder = -20
  ridgeFront.renderOrder = -19
  scene.add(ridgeBack, ridgeFront)
  ridgeBack.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) disposables.push(m.geometry, m.material as THREE.Material) })
  ridgeFront.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) disposables.push(m.geometry, m.material as THREE.Material) })

  // ---- tlo + pista ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x0a0d10, depthWrite: false }),
  )
  ground.position.set(0, 0, -280)
  ground.renderOrder = -10
  scene.add(ground)
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 460).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x151b21, depthWrite: false }),
  )
  runway.position.set(0, 0.02, -210)
  runway.renderOrder = -9
  scene.add(runway)
  disposables.push(ground.geometry, ground.material as THREE.Material, runway.geometry, runway.material as THREE.Material)

  // ivične linije piste
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xa8b2bd, transparent: true, opacity: 0.45, depthWrite: false })
  const edgeGeo = new THREE.PlaneGeometry(0.2, 460).rotateX(-Math.PI / 2)
  for (const x of [-5.8, 5.8]) {
    const m = new THREE.Mesh(edgeGeo, edgeMat)
    m.position.set(x, 0.03, -210); m.renderOrder = -8
    scene.add(m)
  }
  disposables.push(edgeGeo, edgeMat)

  // centralna linija: isprekidana, klizi
  const dashGroup = new THREE.Group()
  const dashGeo = new THREE.PlaneGeometry(0.36, 9).rotateX(-Math.PI / 2)
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xcfd6dd, transparent: true, opacity: 0.55, depthWrite: false })
  const DASH_STEP = 24
  for (let z = 30; z > -420; z -= DASH_STEP) {
    const d = new THREE.Mesh(dashGeo, dashMat)
    d.position.set(0, 0.035, z); d.renderOrder = -8
    dashGroup.add(d)
  }
  scene.add(dashGroup)
  disposables.push(dashGeo, dashMat)

  // holografska mreža oko piste (klizi)
  const gridGroup = new THREE.Group()
  {
    const pts: number[] = []
    const GS = 12
    for (let x = -240; x <= 240; x += GS) {
      if (Math.abs(x) < 9) continue
      pts.push(x, 0.01, 30, x, 0.01, -430)
    }
    for (let z = 30; z >= -430; z -= GS) {
      pts.push(-240, 0.01, z, -9, 0.01, z, 9, 0.01, z, 240, 0.01, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const m = new THREE.LineBasicMaterial({ color: 0x2c6fb7, transparent: true, opacity: 0.22 })
    const grid = new THREE.LineSegments(g, m)
    grid.renderOrder = -7
    gridGroup.add(grid)
    gridGroup.userData.step = GS
    scene.add(gridGroup)
    disposables.push(g, m)
  }

  // ---- svjetla ----
  const WHITE = rgb(0xfff1d6), BLUE = rgb(0x4c8df2), GREEN = rgb(0x3fb27f), AMB = rgb(0xffb52e), RED = rgb(0xe3473f)
  const buf: LightBuf = { pos: [], col: [], size: [], pulse: [] }
  const add = (x: number, y: number, z: number, c: number[], s: number, p = 0) => {
    buf.pos.push(x, y, z); buf.col.push(c[0], c[1], c[2]); buf.size.push(s); buf.pulse.push(p)
  }
  const stepEdge = compact ? 12 : 8
  for (let z = 0; z < LOOP; z += stepEdge) {
    add(-6.2, 0.18, z, z > LOOP - 90 ? AMB : WHITE, 0.3)
    add(6.2, 0.18, z, z > LOOP - 90 ? AMB : WHITE, 0.3)
  }
  for (let z = 0; z < LOOP; z += 12) add(0, 0.1, z, WHITE, 0.26, 1) // "rabbit" sekvenca duž ose
  for (let i = 0; i < 6; i++) { add(-6.2 + i * 2.48, 0.2, 40, GREEN, 0.34) } // prag piste
  for (const tx of [-34, 38]) { // rulne staze: plave ivice + zelena osa
    for (let z = 0; z < LOOP; z += compact ? 14 : 9) { add(tx - 4.4, 0.15, z, BLUE, 0.28); add(tx + 4.4, 0.15, z, BLUE, 0.28) }
    for (let z = 0; z < LOOP; z += 12) add(tx, 0.1, z + 3, GREEN, 0.24, 0)
  }
  for (let z = 0; z < LOOP; z += 60) { // reflektori platforme (visoki stubovi)
    for (const x of [-24, 24]) { add(x, 13, z + 7, AMB, 1.5); add(x, 13.4, z + 7, WHITE, 0.6) }
  }
  for (let z = 0; z < LOOP; z += 90) add(-6.2, 0.2, z + 20, RED, 0.45) // crveni markeri
  const lights = new THREE.Points(lightGeometry(buf), lightMaterial(SPEED, 1, 330))
  lights.frustumCulled = false
  lights.renderOrder = 5
  scene.add(lights)
  lightMats.push(lights.material as THREE.ShaderMaterial)
  disposables.push(lights.geometry, lights.material as THREE.Material)

  // odraz svjetala na mokroj pisti (ogledalo po Y)
  const refl = new THREE.Points(lights.geometry, lightMaterial(SPEED, 0.28, 220))
  refl.scale.y = -1
  refl.frustumCulled = false
  refl.renderOrder = 4
  scene.add(refl)
  lightMats.push(refl.material as THREE.ShaderMaterial)
  disposables.push(refl.material as THREE.Material)

  // daleka svjetla grada (statična)
  {
    const b: LightBuf = { pos: [], col: [], size: [], pulse: [] }
    const n = compact ? 120 : 280
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 760
      const z = 30 + Math.random() * 90 // → z' = z - LOOP + 18 ≈ [-312, -222]
      const warm = Math.random() > 0.35
      const c = warm ? [1.0, 0.72, 0.3] : [0.75, 0.88, 1.0]
      b.pos.push(x, 0.5 + Math.random() * 6, z); b.col.push(c[0], c[1], c[2]); b.size.push(0.35 + Math.random() * 0.5); b.pulse.push(0)
    }
    const city = new THREE.Points(lightGeometry(b), lightMaterial(0, 0.8, 600))
    city.frustumCulled = false
    city.renderOrder = 3
    scene.add(city)
    lightMats.push(city.material as THREE.ShaderMaterial)
    disposables.push(city.geometry, city.material as THREE.Material)
  }

  // ---- avion + HUD ----
  const aircraft = buildAircraft()
  aircraft.scale.setScalar(1.4)
  scene.add(aircraft)
  aircraft.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) disposables.push(m.geometry)
    if (m.material) disposables.push(m.material as THREE.Material)
  })

  // navigaciona svjetla
  const navMat = (c: number) => new THREE.SpriteMaterial({ map: glow, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  const navL = new THREE.Sprite(navMat(0xff2a2a)); navL.position.set(-6.1, -0.35, 1.9); navL.scale.set(1.9, 1.9, 1)
  const navR = new THREE.Sprite(navMat(0x2aff7a)); navR.position.set(6.1, -0.35, 1.9); navR.scale.set(1.9, 1.9, 1)
  const strobe = new THREE.Sprite(navMat(0xffffff)); strobe.position.set(0, 4.5, 6.6); strobe.scale.set(3.2, 3.2, 1)
  const belly = new THREE.Sprite(navMat(0xff2a2a)); belly.position.set(0, -1.0, 2.0); belly.scale.set(1.2, 1.2, 1)
  aircraft.add(navL, navR, strobe, belly)
  disposables.push(navL.material, navR.material, strobe.material, belly.material)

  // vrtložni tragovi sa vrhova krila
  const TRAIL_N = 46
  const trails = [-1, 1].map((side) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_N * 3), 3))
    const colors: number[] = []
    for (let i = 0; i < TRAIL_N; i++) { const f = Math.pow(1 - i / TRAIL_N, 2.2); colors.push(0.5 * f, 0.77 * f, 1.0 * f) }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    line.frustumCulled = false
    aircraft.add(line)
    disposables.push(geo, line.material as THREE.Material)
    return { line, side }
  })

  // HUD prstenovi oko aviona
  const hud = new THREE.Group()
  const hudMat = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  const ringA = new THREE.Mesh(new THREE.RingGeometry(10.4, 10.52, 96), hudMat(AMBER, 0.55))
  const arcs = new THREE.Group()
  for (let i = 0; i < 3; i++) arcs.add(new THREE.Mesh(new THREE.RingGeometry(9.4, 9.62, 40, 1, (i * Math.PI * 2) / 3, 0.95), hudMat(ICE, 0.55)))
  const ticks = new THREE.Group()
  {
    const p: number[] = []
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2, r1 = 10.8, r2 = i % 5 === 0 ? 11.55 : 11.1
      p.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    const m = new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.5, fog: false })
    ticks.add(new THREE.LineSegments(g, m))
    disposables.push(g, m)
  }
  const brackets = new THREE.Group()
  {
    const p: number[] = [], s = 13.2, l = 2.2
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      p.push(sx * s, sy * s, 0, sx * (s - l), sy * s, 0, sx * s, sy * s, 0, sx * s, sy * (s - l), 0)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    const m = new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.8, fog: false })
    brackets.add(new THREE.LineSegments(g, m))
    disposables.push(g, m)
  }
  hud.add(ringA, arcs, ticks, brackets)
  scene.add(hud)
  hud.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry && !disposables.includes(m.geometry)) disposables.push(m.geometry)
    if (m.material && !disposables.includes(m.material as THREE.Material)) disposables.push(m.material as THREE.Material)
  })

  // ---- vozila ----
  const vehicleSlots = [
    { x: 15, z0: 60, ph: 0 },
    { x: -17, z0: 190, ph: 2 },
    { x: 24, z0: 290, ph: 4 },
  ]
  const VLOOP = 340
  const vehicles = vehicleSlots.slice(0, compact ? 2 : 3).map((s) => {
    const v = buildVehicle(glow)
    scene.add(v.group)
    v.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) disposables.push(m.geometry)
      if (m.material && m.material !== v.beacon.material) disposables.push(m.material as THREE.Material)
    })
    disposables.push(v.beacon.material)
    return { ...s, ...v }
  })

  // ---- veličina, kompozicija ----
  function resize() {
    const parent = canvas.parentElement
    const w = Math.max(1, parent ? parent.clientWidth : canvas.clientWidth)
    const h = Math.max(1, parent ? parent.clientHeight : canvas.clientHeight)
    renderer.setSize(w, h, false)
    const aspect = w / h
    camera.aspect = aspect
    camera.fov = aspect < 0.9 ? 66 : aspect < 1.4 ? 58 : 50
    // kompozicija: na širokom ekranu scena je pomjerena ulijevo (alat je desno),
    // na uskom (telefon) nadolje (alat je gore, ispod njega ostaje scena iza naslova)
    let sx = 0, sy = 0
    if (w >= 1024) sx = 0.17 // dvije kolone: tekst lijevo, alat desno
    else sy = -0.4 // jedna kolona: alat gore, scena se spušta iza naslova
    camera.setViewOffset(w, h, sx * w, sy * h, w, h)
    camera.updateProjectionMatrix()
    const scale = (h * pixelRatio) / (2 * Math.tan((camera.fov * Math.PI) / 360))
    for (const m of lightMats) m.uniforms.uScale.value = scale
    const sm = scene.userData.starMat as THREE.ShaderMaterial | undefined
    if (sm) sm.uniforms.uPx.value = pixelRatio
  }
  resize()
  const ro = new ResizeObserver(() => { resize(); if (!running) renderFrame(lastT) })
  if (canvas.parentElement) ro.observe(canvas.parentElement)

  // ---- parallax ----
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
  }
  if (!reducedMotion) window.addEventListener('pointermove', onMove, { passive: true })

  // ---- update/render ----
  let running = false
  let raf = 0
  let lastFrame = 0
  let lastT = reducedMotion ? 3.2 : 0
  let t = lastT
  let readyFired = false
  const speed = reducedMotion ? 0 : SPEED
  const frameMs = compact ? 1000 / 30 : 0
  let adaptSamples = 0, adaptSum = 0, adaptSteps = 0

  function update(time: number, dt: number) {
    for (const m of lightMats) m.uniforms.uTime.value = time
    ;(scene.userData.starMat as THREE.ShaderMaterial).uniforms.uTime.value = time

    const travel = (time * speed) % DASH_STEP
    dashGroup.position.z = travel
    gridGroup.position.z = (time * speed) % gridGroup.userData.step

    // avion: lagano plutanje i nagib u zavoju
    const sw = Math.sin(time * 0.23), cw = Math.cos(time * 0.23)
    aircraft.position.set(1.2 + sw * 2.2, 3.6 + Math.sin(time * 0.31) * 0.35, -34)
    aircraft.rotation.set(-0.025 + Math.sin(time * 0.4) * 0.012, -cw * 0.06, -cw * 0.13)
    navL.material.opacity = navR.material.opacity = 0.9
    strobe.material.opacity = Math.sin(time * 8.5) > 0.9 ? 1 : 0.05
    belly.material.opacity = Math.sin(time * 4.2) > 0.6 ? 0.9 : 0.1
    for (const tr of trails) {
      const arr = tr.line.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < TRAIL_N; i++) {
        const f = i / TRAIL_N
        arr.setXYZ(i,
          tr.side * (6.1 + f * 0.6 + Math.sin(time * 1.1 + i * 0.35) * 0.15 * f),
          -0.4 + Math.cos(time * 0.9 + i * 0.3 + tr.side) * 0.18 * f,
          2.0 + i * 1.15)
      }
      arr.needsUpdate = true
    }
    hud.position.copy(aircraft.position).add(new THREE.Vector3(0, 0.4, 0))
    ringA.rotation.z = time * 0.06
    arcs.rotation.z = -time * 0.35
    ticks.rotation.z = time * 0.12
    hud.scale.setScalar(0.95 * (1 + Math.sin(time * 1.2) * 0.012))

    for (const v of vehicles) {
      const z = ((v.z0 + time * speed) % VLOOP) - VLOOP + 18
      v.group.position.set(v.x, 0, z)
      const flash = Math.pow(Math.max(0, Math.sin(time * 7 + v.ph)), 4)
      v.beacon.material.opacity = 0.12 + 0.88 * flash
      v.beacon.scale.setScalar(3 + flash * 3.2)
    }

    // parallax kamere
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.2)
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.2)
    camera.position.set(CAM_BASE.x + pointer.x * 1.6, CAM_BASE.y - pointer.y * 0.5, CAM_BASE.z)
    camera.lookAt(LOOK.x + pointer.x * 3, LOOK.y, LOOK.z)
  }

  function renderFrame(time: number) {
    update(time, 0.016)
    renderer.render(scene, camera)
    if (!readyFired) { readyFired = true; opts.onReady?.() }
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop)
    const el = now - lastFrame
    if (el < frameMs - 2) return
    lastFrame = now
    const dt = Math.min(el, 100) / 1000
    t += dt
    lastT = t
    update(t, dt)
    renderer.render(scene, camera)
    if (!readyFired) { readyFired = true; opts.onReady?.() }
    // adaptivna rezolucija: ako je prosječan frame spor, spusti pixelRatio
    if (!compact && adaptSteps < 2 && pixelRatio > 1) {
      adaptSamples++
      if (adaptSamples > 12) adaptSum += el
      if (adaptSamples >= 72) {
        if (adaptSum / 60 > 27) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); resize() }
        adaptSamples = 0; adaptSum = 0; adaptSteps++
      }
    }
  }

  return {
    start() {
      if (running) return
      if (reducedMotion) { renderFrame(lastT); return }
      running = true
      lastFrame = performance.now()
      raf = requestAnimationFrame(loop)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      const seen = new Set<unknown>()
      for (const d of disposables) { if (!seen.has(d)) { seen.add(d); d.dispose() } }
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose() }
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) if (!seen.has(x)) { seen.add(x); x.dispose() }
      })
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
