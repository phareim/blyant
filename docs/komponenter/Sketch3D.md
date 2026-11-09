# Sketch3D

three.js-renderer som tegner hele scenen med blyant: dobbel skjelvende kontur fra normaler og dybde, skravur fra lyset, fargeblyant-fyll med papirkorn. Følger Papir og Kull automatisk.

**Krever** three.js r147 som UMD lastet før bundle: `https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js`.

```js
const sketch = new Blyant.Sketch3D(el, { fov: 32, lineWidth: 1.1, hatchGap: 5.5, boil: false });
sketch.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), sketch.mat("--dust-purple")));
sketch.start((dt, t) => { /* animer */ });
```

- Konsumenten gir en container med høyde (bruk `.b-canvas`). Renderer følger størrelsen med ResizeObserver.
- `sketch.mat(farge, { light })`: token, hex eller CSS-farge. Vanlige three-materialer tegnes uten skravur.
- `sketch.pick(x, y, objekter)` for klikk og hover. `sketch.dispose()` når visningen forlates.
- Fra Blender: glTF 2.0 (.glb), materialnavn = tokennavn, bytt til `sketch.mat("--" + navn)`.
