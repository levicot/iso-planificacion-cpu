'use strict';
// Motor de planificación: caso resuelto a mano, invariantes y números que cita el README.
const test = require('node:test');
const assert = require('node:assert/strict');
const {cargarMotor} = require('./cargar-motor');

const M = cargarMotor();
const {cpuF, ioF, simular, aPs, ALGS, EJEMPLOS, SO} = M;
const TODAS = ALGS.map(a => a.id);
const cfg = (alg, extra = {}) => ({alg, quantum:2, cambio:0, envej:0, emp:'llegadas', ...extra});
const mk = filas => filas.map((f, i) => ({id:'P' + (i + 1), i, llegada:f[0], fases:f[1], prio:f[2] || 0}));
const ejemplo = nombre => { const e = EJEMPLOS[nombre](); return {ps:aPs(e.lote, e.devs), devs:e.devs, cfg:e.cfg}; };
const LOTES = () => ['es', 'cpu', 'prio', 'es2'].map(ejemplo);
const J = x => JSON.stringify(x);
const media = (s, k) => (s.met.reduce((a, m) => a + m[k], 0) / s.met.length).toFixed(2);
const peor = (s, k) => Math.max(...s.met.map(m => m[k]));
const pct = x => (x * 100).toFixed(0);
const gantt = s => {
  const r = [];
  for(let t = 0; t < s.T; t++){
    const v = s.cpuL[t] || '--';
    if(r.length && r[r.length - 1].v === v) r[r.length - 1].h = t + 1;
    else r.push({v, d:t, h:t + 1});
  }
  return r.map(x => `${x.v}[${x.d}-${x.h}]`).join(' ');
};

const CLASICO = mk([[0, [cpuF(7)]], [2, [cpuF(4)]], [4, [cpuF(1)]], [5, [cpuF(4)]]]);

test('el caso resuelto a mano: FCFS, SJF, SRTF y Round Robin', () => {
  const esperado = {
    fcfs:['P1[0-7] P2[7-11] P3[11-12] P4[12-16]', '4.75'],
    sjf: ['P1[0-7] P3[7-8] P2[8-12] P4[12-16]', '4.00'],
    srtf:['P1[0-2] P2[2-4] P3[4-5] P2[5-7] P4[7-11] P1[11-16]', '3.00'],
    rr:  ['P1[0-2] P2[2-4] P1[4-6] P3[6-7] P2[7-9] P4[9-11] P1[11-13] P4[13-15] P1[15-16]', '5.00']
  };
  for(const [alg, [diagrama, espera]] of Object.entries(esperado)){
    const s = simular(CLASICO, ['Disco'], cfg(alg));
    assert.equal(gantt(s), diagrama, alg);
    assert.equal(media(s, 'espCPU'), espera, alg);
    assert.equal(s.T, 16, alg);
  }
});

test('VRR sin E/S produce exactamente el diagrama de Round Robin', () => {
  for(let q = 1; q <= 4; q++)
    assert.equal(gantt(simular(CLASICO, ['Disco'], cfg('vrr', {quantum:q}))),
      gantt(simular(CLASICO, ['Disco'], cfg('rr', {quantum:q}))), `quantum ${q}`);
});

test('identidad de métricas: retorno = CPU + E/S + espera de CPU + espera de E/S', () => {
  for(const L of LOTES()) for(const alg of TODAS) for(const cambio of [0, 2]) for(const envej of [0, 2, 3]){
    const s = simular(L.ps, L.devs, cfg(alg, {cambio, envej})), et = `${alg} costo ${cambio} envej ${envej}`;
    assert.ok(s.T < 400, `${et}: la simulación no termina`);
    for(const m of s.met) assert.equal(m.retorno, m.cpu + m.es + m.espCPU + m.espES, `${et} ${m.id}`);
    const util = L.ps.reduce((a, p) => a + p.fases.filter(f => f.t === 'cpu').reduce((x, f) => x + f.d, 0), 0);
    assert.equal(s.cpuL.slice(0, s.T).filter(x => x && x !== SO).length, util, `${et}: CPU útil`);
  }
});

test('dispositivos: servicio igual a lo pedido, exclusión mutua y restante coherente', () => {
  for(const nombre of ['es', 'es2']){
    const L = ejemplo(nombre);
    for(const alg of TODAS) for(const cambio of [0, 2]){
      const s = simular(L.ps, L.devs, cfg(alg, {cambio})), et = `${nombre} ${alg} costo ${cambio}`;
      L.devs.forEach((n, k) => {
        const pedido = L.ps.reduce((a, p) => a + p.fases.filter(f => f.t === 'io' && f.dev === k).reduce((x, f) => x + f.d, 0), 0);
        assert.equal(s.devL[k].slice(0, s.T).filter(Boolean).length, pedido, `${et} ${n}`);
      });
      for(const pa of s.pasos){
        const ocupantes = [pa.corriendo, ...pa.devs.map(d => d.ocupa)].filter(Boolean);
        assert.equal(new Set(ocupantes).size, ocupantes.length, `${et} t=${pa.t}: un proceso en dos recursos`);
        for(const d of pa.devs) if(d.ocupa){
          const sn = pa.snap.find(x => x.id === d.ocupa);
          assert.equal(sn.estado, 'usandoES', `${et} t=${pa.t}`);
          assert.equal(sn.restante, d.restante, `${et} t=${pa.t}: estados y dispositivo difieren`);
        }
        for(const sn of pa.snap) assert.ok(sn.restante >= 0, `${et} t=${pa.t} ${sn.id}: restante negativo`);
      }
    }
  }
});

test('costo de cambio de contexto: sobrecarga = cambios × costo y nadie ejecuta durante un cambio', () => {
  for(const L of [ejemplo('es'), ejemplo('cpu')]) for(const alg of TODAS){
    const s0 = simular(L.ps, L.devs, cfg(alg));
    assert.equal(s0.soTot, 0, alg);
    const antes = s0.cpuL.filter((x, i) => i && x && x !== s0.cpuL[i - 1]).length;
    assert.equal(s0.cambios, antes, `${alg}: con costo 0 el recuento de cambios no varía`);
    for(const cambio of [1, 2, 3]){
      const s = simular(L.ps, L.devs, cfg(alg, {cambio}));
      assert.equal(s.soTot, s.cambios * cambio, `${alg} costo ${cambio}`);
      for(const pa of s.pasos) if(pa.so) assert.equal(pa.corriendo, null, `${alg} t=${pa.t}: ejecuta durante un cambio`);
    }
  }
});

test('la curva del quantum sobre el lote con CPU disputada, con costo 1', () => {
  const L = ejemplo('cpu');
  const cols = x => [x.T, media(x, 'espCPU'), peor(x, 'espCPU'), media(x, 'respuesta'), media(x, 'retorno'), x.cambios, pct(x.uso)];
  const rr = Object.fromEntries([1, 2, 4, 8].map(q => [q, simular(L.ps, L.devs, cfg('rr', {quantum:q, cambio:1}))]));
  const fcfs = simular(L.ps, L.devs, cfg('fcfs', {cambio:1}));
  assert.equal(pct(rr[1].sobrecarga), '48', 'quantum 1: porcentaje del tiempo cambiando de contexto');
  assert.equal(gantt(rr[8]), gantt(fcfs), 'quantum 8: el diagrama de FCFS');
  assert.equal(J(cols(rr[8])), J(cols(fcfs)), 'quantum 8: los números de FCFS');
  assert.equal(J([media(rr[1], 'respuesta'), media(rr[8], 'respuesta')]), J(['3.60', '10.60']), 'respuesta media');
  for(const q of [2, 4, 8]){
    const a = rr[1], b = rr[q];
    assert.ok(+media(a, 'respuesta') < +media(b, 'respuesta'), `quantum 1 no tiene mejor respuesta que ${q}`);
    assert.ok(a.T > b.T && +media(a, 'espCPU') > +media(b, 'espCPU') && peor(a, 'espCPU') > peor(b, 'espCPU') &&
      +media(a, 'retorno') > +media(b, 'retorno') && a.cambios > b.cambios, `quantum 1 no pierde en todo lo demás contra ${q}`);
  }
});

test('prioridades y envejecimiento: rango, prioridad base al ejecutar y expropiación coherente', () => {
  for(const L of LOTES()) for(const alg of TODAS) for(const cambio of [0, 2]) for(const envej of [0, 2, 3]){
    const s = simular(L.ps, L.devs, cfg(alg, {cambio, envej})), et = `${alg} costo ${cambio} envej ${envej}`;
    s.pasos.forEach((pa, i) => {
      for(const sn of pa.snap){
        assert.ok(sn.prioAct >= 0 && sn.prioAct <= sn.prio, `${et} t=${pa.t} ${sn.id}: prioridad fuera de rango`);
        if(sn.estado === 'ejecutando') assert.equal(sn.prioAct, sn.prio, `${et} t=${pa.t}: ejecuta sin su prioridad base`);
        if(!M.usaPrio(alg) || envej === 0) assert.equal(sn.prioAct, sn.prio, `${et} t=${pa.t}: envejeció donde no corresponde`);
      }
      // expropiativa: con al menos una unidad ejecutada, nadie más urgente puede seguir esperando
      if(alg === 'prioE' && pa.corriendo && !pa.so && i > 0 && s.pasos[i - 1].corriendo === pa.corriendo){
        const r = pa.snap.find(x => x.id === pa.corriendo);
        for(const x of pa.snap.filter(x => x.estado === 'listo'))
          assert.ok(x.prioAct >= r.prioAct, `${et} t=${pa.t}: ${x.id} espera siendo más urgente que ${r.id}`);
      }
    });
  }
  // el envejecimiento cuenta la espera de CPU y no la de E/S
  const s = simular(mk([[0, [cpuF(1), ioF(0, 20), cpuF(1)], 5], [0, [cpuF(30)], 0]]), ['Disco'], cfg('prio', {envej:1}));
  let prev = null, mejoraEnES = false, mejoraListo = false;
  for(const pa of s.pasos){
    const p1 = pa.snap.find(x => x.id === 'P1');
    if((p1.estado === 'usandoES' || p1.estado === 'esperaES') && prev !== null && p1.prioAct !== prev) mejoraEnES = true;
    if(p1.estado === 'listo' && prev !== null && p1.prioAct < prev) mejoraListo = true;
    prev = p1.prioAct;
  }
  assert.ok(!mejoraEnES, 'la prioridad mejoró durante la E/S');
  assert.ok(mejoraListo, 'la prioridad nunca mejoró esperando la CPU');
});

test('VRR: la cola auxiliar sólo contiene procesos listos con quantum pendiente', () => {
  const L = ejemplo('es');
  for(const quantum of [2, 3, 4]) for(const cambio of [0, 2]){
    const s = simular(L.ps, L.devs, cfg('vrr', {quantum, cambio})), et = `q=${quantum} costo ${cambio}`;
    s.pasos.forEach((pa, i) => {
      for(const id of pa.aux){
        assert.ok(!pa.cola.includes(id), `${et} t=${pa.t}: ${id} en las dos colas`);
        const sn = pa.snap.find(x => x.id === id);
        assert.ok(sn.resto > 0 && sn.resto <= quantum, `${et} t=${pa.t}: remanente ${sn.resto}`);
        assert.equal(sn.estado, 'listo', `${et} t=${pa.t}`);
      }
      if(pa.aux.length && !pa.so) assert.notEqual(pa.corriendo, null, `${et} t=${pa.t}: CPU ociosa con la auxiliar no vacía`);
      const ant = s.pasos[i - 1];
      if(cambio === 0 && ant && pa.corriendo && ant.aux[0] === pa.corriendo && ant.corriendo !== pa.corriendo){
        const resto = ant.snap.find(x => x.id === pa.corriendo).resto;
        let ejec = 0;
        for(let k = i; k < s.pasos.length && s.pasos[k].corriendo === pa.corriendo; k++) ejec++;
        assert.ok(ejec <= resto, `${et} t=${pa.t}: ejecutó ${ejec} con remanente ${resto}`);
      }
    });
  }
});

test('modo Predecir: cada decisión guarda el estado previo y su respuesta es una de las opciones', () => {
  for(const L of LOTES()) for(const alg of TODAS){
    const s = simular(L.ps, L.devs, cfg(alg));
    for(const pa of s.pasos){
      if(!pa.decision) continue;
      const et = `${alg} t=${pa.t}`;
      assert.ok(pa.pre, `${et}: decisión sin estado previo`);
      assert.equal(J([...pa.opciones].sort()), J([...pa.pre.aux, ...pa.pre.cola].sort()), `${et}: opciones`);
      if(pa.respuesta === null){
        assert.equal(pa.opciones.length, 0, `${et}: CPU ociosa habiendo candidatos`);
      } else {
        assert.ok(pa.opciones.includes(pa.respuesta), `${et}: la respuesta no es una opción`);
        assert.equal(pa.corriendo, pa.respuesta, `${et}: el elegido no ejecuta en ese instante`);
        assert.ok(!pa.cola.includes(pa.respuesta) && !pa.aux.includes(pa.respuesta),
          `${et}: el estado posterior revela la respuesta y además la sigue mostrando en cola`);
      }
    }
  }
});

test('modo Predecir: el lote con E/S tiene 15 preguntas, 11 de ellas disputadas', () => {
  const L = ejemplo('es'), s = simular(L.ps, L.devs, L.cfg);
  assert.equal(J([M.preguntasPredecir(s, 'todas').length, M.preguntasPredecir(s, 'disputadas').length]), J([15, 11]));
});

test('lotes de ejemplo: valores de referencia, incluidos los que cita el README', () => {
  const resumen = x => [x.T, media(x, 'espCPU'), peor(x, 'espCPU'), media(x, 'respuesta'), media(x, 'retorno'), x.cambios];

  let L = ejemplo('es');
  let s = simular(L.ps, L.devs, L.cfg);
  assert.equal(J([s.T, s.cambios, pct(s.uso), s.usoDev.map(pct).join()]), J([23, 10, '83', '48,13']), 'con E/S');
  assert.equal(J(s.met.map(m => [m.cpu, m.es, m.espCPU, m.espES, m.fin, m.retorno, m.respuesta])),
    J([[5, 5, 3, 5, 18, 18, 0], [5, 6, 4, 0, 16, 15, 1], [6, 3, 4, 0, 22, 13, 0], [3, 0, 4, 0, 23, 7, 2]]), 'con E/S: métricas');
  const conES = {fcfs:[22, '1.75', 4, '1.00', '10.75', 6], sjf:[22, '1.50', 3, '1.50', '10.50', 6],
    srtf:[22, '1.50', 3, '1.50', '10.50', 6], rr:[23, '3.75', 4, '0.75', '13.25', 10]};
  for(const [alg, v] of Object.entries(conES)) assert.equal(J(resumen(simular(L.ps, L.devs, {...L.cfg, alg}))), J(v), `con E/S, ${alg}`);
  assert.equal(gantt(simular(L.ps, L.devs, {...L.cfg, alg:'sjf'})), gantt(simular(L.ps, L.devs, {...L.cfg, alg:'srtf'})),
    'con E/S, SJF y SRTF dan el mismo diagrama');

  L = ejemplo('cpu');
  const disputada = {fcfs:[22, '8.60', 15, '8.60', '13.00', 4], sjf:[22, '7.60', 14, '7.60', '12.00', 4],
    srtf:[22, '5.20', 14, '2.00', '9.60', 6], rr:[22, '10.00', 14, '2.80', '14.40', 11]};
  for(const [alg, v] of Object.entries(disputada)) assert.equal(J(resumen(simular(L.ps, L.devs, cfg(alg)))), J(v), `CPU disputada, ${alg}`);
  assert.equal(gantt(simular(L.ps, L.devs, cfg('srtf'))), 'P1[0-1] P2[1-2] P3[2-4] P2[4-7] P5[7-10] P4[10-15] P1[15-22]',
    'CPU disputada: SRTF deja a P1 sin CPU entre t=1 y t=15');

  L = ejemplo('prio');
  for(const [envej, esperaP2, respP2, med, peorE] of [[0, 14, 14, '3.00', 14], [2, 8, 8, '3.67', 8], [3, 14, 14, '3.00', 14], [4, 14, 14, '3.00', 14]]){
    s = simular(L.ps, L.devs, {...L.cfg, envej});
    const p2 = s.met.find(m => m.id === 'P2');
    assert.equal(J([p2.espCPU, p2.respuesta, media(s, 'espCPU'), peor(s, 'espCPU')]), J([esperaP2, respP2, med, peorE]), `inanición, envejecimiento ${envej}`);
  }

  L = ejemplo('es2');
  const rr = simular(L.ps, L.devs, {...L.cfg, alg:'rr'}), vrr = simular(L.ps, L.devs, {...L.cfg, alg:'vrr'});
  assert.equal(J([media(rr, 'espCPU'), media(vrr, 'espCPU')]), J(['5.00', '2.33']), 'ligado a E/S: espera media');
  assert.equal(J([rr.met.map(m => m.espCPU).join(), vrr.met.map(m => m.espCPU).join()]), J(['3,7,5', '0,1,6']), 'ligado a E/S: por proceso');
  assert.equal(J([rr.T, vrr.T, rr.cambios, vrr.cambios]), J([18, 18, 9, 8]), 'ligado a E/S: tiempo y cambios');
});
