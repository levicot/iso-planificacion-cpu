'use strict';
// Generadores de desafíos y corrección de "Predecir decisiones" y "Leer el diagrama".
const test = require('node:test');
const assert = require('node:assert/strict');
const {cargarMotor} = require('./cargar-motor');

const M = cargarMotor();
const {cpuF, ioF, simular, aPs, ALGS, NIVELES, QMAX, usaQuantum} = M;
const NIVELES_IDS = ['facil', 'medio', 'dificil'];
const semillas = (prefijo, n = 40) => Array.from({length:n}, (_, i) => prefijo + i);
const J = x => JSON.stringify(x);

function desafio(sem, nivel){
  const g = M.generarDesafio(sem, nivel);
  return {g, s:simular(aPs(g.lote, g.devs), g.devs, g.cfg)};
}

// reconstruye el lote usando sólo lo que muestra el diagrama: estados por instante y filas de dispositivo
function leerDelDiagrama(s){
  return s.ps.map(p => {
    const L = s.linea[p.id], llegada = L.findIndex(v => v !== 'nuevo'), fases = [];
    let act = null;
    for(let t = llegada; t < s.T; t++){
      const v = L[t];
      if(v === 'terminado') break;
      const esIO = v === 'usandoES' || v === 'esperaES';
      if(!act || esIO !== (act.t === 'io')){ act = esIO ? {t:'io', dev:null, d:0} : {t:'cpu', d:0}; fases.push(act); }
      if(v === 'ejecutando') act.d++;
      if(v === 'usandoES'){ act.d++; if(act.dev === null) act.dev = s.devL.findIndex(l => l[t] === p.id); }
    }
    return {llegada, fases};
  });
}

test('los generadores son deterministas', () => {
  for(const sem of semillas('s', 10)){
    assert.equal(J(M.generarLote(sem, ['Disco', 'Impresora'])), J(M.generarLote(sem, ['Disco', 'Impresora'])), sem);
    assert.equal(J(M.generarPred(sem, 'azar')), J(M.generarPred(sem, 'azar')), sem);
    for(const nivel of NIVELES_IDS) assert.equal(J(M.generarDesafio(sem, nivel)), J(M.generarDesafio(sem, nivel)), `${nivel} ${sem}`);
  }
});

test('cada nivel cumple sus garantías', () => {
  for(const nivel of NIVELES_IDS) for(const sem of semillas('s')){
    const {g, s} = desafio(sem, nivel), N = NIVELES[nivel], et = `${nivel} ${sem}`;
    const partidos = s.ps.filter(p => M.bloquesCPU(s, p.id) >= 2).length;
    const conES = g.lote.filter(p => p.fases.length > 1).length;
    assert.ok(N.algs.includes(g.cfg.alg), `${et}: política fuera del nivel`);
    assert.ok(g.lote.length >= N.procs[0] && g.lote.length <= N.procs[1], `${et}: ${g.lote.length} procesos`);
    assert.ok(s.met.reduce((a, m) => a + m.espCPU, 0) >= 2, `${et}: casi sin espera`);
    if(nivel === 'facil') assert.equal(J([partidos, conES, g.devs.length]), J([0, 0, 0]), `${et}: ráfagas partidas, E/S o dispositivos`);
    if(nivel === 'medio'){
      assert.ok(partidos > 0, `${et}: sin expropiación visible`);
      assert.equal(J([conES, g.devs.length]), J([0, 0]), `${et}: E/S o dispositivos`);
    }
    if(nivel === 'dificil'){
      assert.ok(conES >= 2, `${et}: menos de dos procesos con E/S`);
      assert.equal(g.devs.length, 2, et);
    }
  }
});

test('los diagramas discriminan: una política en fácil y medio, a lo sumo dos en difícil', () => {
  for(const nivel of NIVELES_IDS) for(const sem of semillas('s')){
    const {g, s} = desafio(sem, nivel), et = `${nivel} ${sem}`;
    const an = M.analizarPoliticas(g.lote, g.devs, s, NIVELES[nivel].algs), S = an.filter(x => x.reproduce);
    if(nivel === 'dificil') assert.ok(S.length <= 2, `${et}: ${S.length} políticas lo reproducen`);
    else assert.equal(S.length, 1, `${et}: políticas que lo reproducen`);
    const propia = an.find(x => x.alg === g.cfg.alg);
    assert.ok(propia.reproduce, `${et}: la política real no reproduce su diagrama`);
    if(usaQuantum(g.cfg.alg)) assert.ok(propia.quantums.includes(g.cfg.quantum), `${et}: el quantum real no es válido`);
    for(const x of an.filter(x => !x.reproduce))
      assert.ok(Number.isFinite(x.mejor.div.t) && x.mejor.div.txt, `${et}: ${x.alg} no reproduce pero no hay diferencia que explicar`);
  }
});

test('cada desafío se puede reconstruir leyendo sólo el diagrama', () => {
  for(const nivel of NIVELES_IDS) for(const sem of semillas('s')){
    const {g, s} = desafio(sem, nivel);
    const lote = leerDelDiagrama(s).map((x, k) => ({llegada:x.llegada, prio:g.lote[k].prio,
      fases:x.fases.map(f => f.t === 'cpu' ? cpuF(f.d) : ioF(f.dev, f.d))}));
    assert.ok(M.mismoDiagrama(simular(aPs(lote, g.devs), g.devs, g.cfg), s), `${nivel} ${sem}`);
  }
});

test('corrección del lote por re-simulación', () => {
  for(const nivel of NIVELES_IDS) for(const sem of semillas('s')){
    const {g, s} = desafio(sem, nivel), et = `${nivel} ${sem}`;
    const base = leerDelDiagrama(s).map(x => ({llegada:String(x.llegada), fases:x.fases.map(f => ({t:f.t, dev:f.dev, d:String(f.d)}))}));
    const corregir = rec => { const leer = {nivel, gen:g, rec, resp:{}, corregido:false, recRes:null}; M.fijar(leer, s); M.corregirRec(); return leer.recRes; };
    const con = cambio => { const r = JSON.parse(J(base)); cambio(r); return corregir(r); };

    let R = corregir(JSON.parse(J(base)));
    assert.ok(R.tocado && R.reproduce && R.ok === R.tot, `${et}: rechaza el lote correcto`);

    R = con(r => { r[0].llegada = String(+r[0].llegada + 1); });
    assert.ok(!R.reproduce && R.fb[0].llOk === false && R.ok <= R.tot, `${et}: llegada corrida`);
    R = con(r => { const u = r[r.length - 1]; u.fases[0].d = String(+u.fases[0].d + 1); });
    assert.ok(!R.reproduce && R.ok <= R.tot, `${et}: ráfaga de CPU distinta`);

    const io = base.findIndex(p => p.fases.length > 1);
    if(io >= 0){
      R = con(r => { r[io].fases[1].d = String(+r[io].fases[1].d + 1); });
      assert.ok(!R.reproduce && R.fb[io].durOk[1] === false && R.fb[io].devOk[1] === true, `${et}: duración de E/S, marca sólo la duración`);
      R = con(r => { r[io].fases[1].dev = 1 - r[io].fases[1].dev; });
      assert.ok(!R.reproduce && R.fb[io].devOk[1] === false && R.fb[io].durOk[1] === true, `${et}: dispositivo, marca sólo el dispositivo`);
      R = con(r => { r[io].fases.splice(-2, 2); });
      assert.ok(!R.reproduce && R.fb[io].mismaEstructura === false, `${et}: una E/S de menos`);
    }
    assert.equal(corregir(base.map(() => ({llegada:'', fases:[{t:'cpu', d:''}]}))).tocado, false, `${et}: corrigió un lote vacío`);
    R = con(r => { r[0].fases[0].d = ''; });
    assert.ok(R.tocado && !R.valido && !R.reproduce, `${et}: no reporta un campo vacío`);
  }
});

test('corrección de la identificación de la política', () => {
  for(const nivel of NIVELES_IDS){
    const algs = NIVELES[nivel].algs;
    for(const sem of semillas('id')){
      const {g, s} = desafio(sem, nivel), et = `${nivel} ${sem}`;
      const an = M.analizarPoliticas(g.lote, g.devs, s, algs), S = an.filter(x => x.reproduce);
      const exacta = {};
      for(const x of S) exacta[x.alg] = {on:true, q:x.quantums.length ? String(x.quantums[0]) : ''};
      const corregir = ident => { const leer = {nivel, gen:g, ident:JSON.parse(J(ident)), identRes:null}; M.fijar(leer, s); M.corregirIdent(); return leer.identRes; };

      let R = corregir(exacta);
      assert.ok(R.tocado && R.ok === R.tot && R.tot === algs.length, `${et}: la respuesta exacta obtiene ${R.ok} de ${R.tot}`);

      const noS = an.find(x => !x.reproduce);
      if(noS){
        R = corregir({...exacta, [noS.alg]:{on:true, q:'2'}});
        assert.ok(!R.por[noS.alg].bien && R.ok === R.tot - 1 && /^No lo produce: en t=/.test(R.por[noS.alg].txt), `${et}: ${noS.alg} marcada de más`);
      }
      const sin = {...exacta};
      delete sin[S[0].alg];
      R = corregir(sin);
      if(Object.keys(sin).length) assert.ok(!R.por[S[0].alg].bien && /^Sí lo produce/.test(R.por[S[0].alg].txt), `${et}: ${S[0].alg} omitida`);
      else assert.equal(R.tocado, false, `${et}: sin nada marcado debería quedar sin completar`);

      const conQ = S.find(x => usaQuantum(x.alg));
      if(conQ){
        const malo = [1, 2, 3, 4, 5, 6, 7].find(q => !conQ.quantums.includes(q));
        if(malo){
          R = corregir({...exacta, [conQ.alg]:{on:true, q:String(malo)}});
          assert.ok(!R.por[conQ.alg].bien && /^Con quantum \d+ no: en t=/.test(R.por[conQ.alg].txt), `${et}: quantum ${malo} equivocado`);
        }
        R = corregir({...exacta, [conQ.alg]:{on:true, q:''}});
        assert.ok(!R.por[conQ.alg].bien && /faltó indicar el quantum/.test(R.por[conQ.alg].txt), `${et}: quantum faltante`);
        if(conQ.alg === 'rr' && conQ.quantums.includes(QMAX)){
          R = corregir({...exacta, rr:{on:true, q:'12'}});
          assert.ok(R.por.rr.bien, `${et}: RR con quantum 12 reproduce el diagrama y no se acepta`);
        }
      }
      assert.equal(corregir({}).tocado, false, `${et}: sin nada marcado se corrigió`);
    }
  }
});

test('Predecir: la semilla fija el lote aunque cambie la política', () => {
  const vistas = new Set();
  for(const sem of semillas('s', 30)){
    const azar = M.generarPred(sem, 'azar');
    vistas.add(azar.cfg.alg);
    for(const a of ALGS){
      const g = M.generarPred(sem, a.id);
      assert.equal(J(g.lote), J(azar.lote), `${sem} ${a.id}: el lote cambió con la política`);
      assert.equal(g.cfg.alg, a.id, `${sem}: no respeta la política elegida`);
      assert.equal(g.cfg.quantum, azar.cfg.quantum, `${sem}: el quantum depende de la política elegida`);
    }
  }
  assert.equal(vistas.size, ALGS.length, 'la política al azar no recorre todas las políticas');
});

test('el generador de desafíos es rápido', () => {
  const t0 = Date.now();
  for(const nivel of NIVELES_IDS) for(const sem of semillas('s')) M.generarDesafio(sem, nivel);
  const ms = Date.now() - t0;
  assert.ok(ms < 2000, `120 generaciones tardaron ${ms} ms`);
});
