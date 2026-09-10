#!/usr/bin/env node
'use strict';
// index.html es la fuente del proyecto: una página autónoma que se abre con doble clic y se
// publica en GitHub Pages. La publicación como artifact de Claude exige el mismo contenido sin
// <html>, <head> ni <body>: ese fragmento es simulador.html, que no se versiona.
//
//   node herramientas/html.js fragmento   genera simulador.html a partir de index.html
//   node herramientas/html.js index       genera index.html a partir de simulador.html
const fs = require('node:fs');
const path = require('node:path');

const CABECERA = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
const MEDIO = '</head>\n<body>\n';
const PIE = '</body>\n</html>';

function aFragmento(index){
  const j = index.indexOf(MEDIO), k = index.lastIndexOf(PIE);
  if(!index.startsWith(CABECERA) || j < 0 || k < 0) throw new Error('index.html no tiene la estructura esperada');
  return index.slice(CABECERA.length, j).trimEnd() + '\n\n' + index.slice(j + MEDIO.length, k).trimEnd() + '\n';
}

function aIndex(fragmento){
  const corte = fragmento.indexOf('<div class="app">');
  if(corte < 0) throw new Error('el fragmento no contiene <div class="app">');
  return `${CABECERA}${fragmento.slice(0, corte).trimEnd()}\n${MEDIO}${fragmento.slice(corte)}\n${PIE}\n`;
}

if(require.main === module){
  const raiz = path.join(__dirname, '..');
  const leer = f => fs.readFileSync(path.join(raiz, f), 'utf8');
  const modo = process.argv[2];
  if(modo === 'fragmento'){
    fs.writeFileSync(path.join(raiz, 'simulador.html'), aFragmento(leer('index.html')));
    console.log('simulador.html generado a partir de index.html');
  } else if(modo === 'index'){
    fs.writeFileSync(path.join(raiz, 'index.html'), aIndex(leer('simulador.html')));
    console.log('index.html generado a partir de simulador.html');
  } else {
    console.error('uso: node herramientas/html.js fragmento   (index.html → simulador.html)');
    console.error('     node herramientas/html.js index       (simulador.html → index.html)');
    process.exitCode = 1;
  }
}

module.exports = {aFragmento, aIndex};
