'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {aFragmento, aIndex} = require('../herramientas/html');

test('herramienta html: index.html → fragmento → index.html es exacto', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const fragmento = aFragmento(index);
  assert.ok(fragmento.startsWith('<title>'), 'el fragmento debería empezar por el título');
  assert.ok(!fragmento.startsWith('<!doctype'), 'el fragmento conserva la cabecera del documento');
  assert.equal(aIndex(fragmento), index);
});
