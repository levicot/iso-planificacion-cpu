'use strict';
// Carga las funciones puras del simulador directamente desde index.html, sin copiarlas:
// si el código de la página cambia, los tests prueban la versión nueva. La extracción se
// apoya en nombres de funciones y constantes; si alguno se renombra, falla diciendo cuál.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX = path.join(__dirname, '..', 'index.html');

function cargarMotor(){
  const html = fs.readFileSync(INDEX, 'utf8');
  const ini = html.indexOf('<script>'), fin = html.lastIndexOf('</script>');
  if(ini < 0 || fin < 0) throw new Error('index.html no tiene un bloque <script>');
  const lineas = html.slice(ini + '<script>'.length, fin).split('\n');

  const linea = re => {
    const l = lineas.find(x => re.test(x));
    if(!l) throw new Error(`no encontré en index.html la línea ${re}`);
    return l;
  };
  const tramo = (desde, hasta, incluirHasta = false) => {
    const i = lineas.findIndex(x => desde.test(x));
    if(i < 0) throw new Error(`no encontré en index.html el inicio ${desde}`);
    const j = lineas.findIndex((x, k) => k > i && hasta.test(x));
    if(j < 0) throw new Error(`no encontré en index.html el final ${hasta} (después de ${desde})`);
    return lineas.slice(i, incluirHasta ? j + 1 : j).join('\n');
  };

  const codigo = [
    linea(/^const MAXP = /),
    linea(/^const cpuF = /),
    linea(/^const ioF = /),
    tramo(/^const EJEMPLOS = \{/, /^\};/, true),
    linea(/^const SO = /),
    tramo(/^const ALGS = \[/, /^\];/, true),
    linea(/^const usaPrio = /),
    linea(/^const usaQuantum = /),
    linea(/^const MAXPRIO = /),
    tramo(/^function elegir\(/, /^const pc = /),
    tramo(/^function rngDe\(/, /^function extraDe\(/),
    tramo(/^function armarEjercicio\(/, /^}/, true),
    // estado global que leen las funciones de corrección y armarEjercicio; lo fijan los tests
    'var leer = null, sim = null, ej = null, $ = null;'
  ].join('\n');

  const nombres = ['ALGS', 'EJEMPLOS', 'MAXDUR', 'QMAX', 'NIVELES', 'DEVS_DESAFIO', 'SO', 'cpuF', 'ioF',
    'usaPrio', 'usaQuantum', 'simular', 'elegir', 'rngDe', 'generarLote', 'generarDesafio', 'generarPred',
    'aPs', 'bloquesCPU', 'cfgCon', 'analizarPoliticas', 'primeraDiferencia', 'mismoDiagrama',
    'corregirRec', 'corregirIdent', 'listaQ'];
  const contexto = vm.createContext({console});
  const motor = vm.runInContext(`${codigo}\n;({${nombres.join(', ')}})`, contexto, {filename:'index.html'});
  motor.fijar = (leer, sim) => { contexto.leer = leer; contexto.sim = sim; };
  // instantes en que Predecir decisiones hace una pregunta; filtro es 'todas' o 'disputadas'
  motor.preguntasPredecir = (s, filtro) => {
    contexto.sim = s;
    contexto.$ = () => ({value:filtro});
    vm.runInContext('armarEjercicio()', contexto);
    return contexto.ej.preguntas;
  };
  return motor;
}

module.exports = {cargarMotor};
