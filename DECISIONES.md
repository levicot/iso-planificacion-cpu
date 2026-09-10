# Decisiones de diseño

El [README](README.md) cuenta qué hace el simulador. Este documento registra
**por qué** hace las cosas así: las convenciones que se eligieron, las
alternativas que se descartaron y los errores que obligaron a fijar una regla.
Donde una decisión está protegida por un test, se indica cuál (los tests viven
en [`tests/`](tests) y se corren con `npm test`).

Antes de cambiar algo de lo que figura acá, conviene leer el motivo: varias
reglas parecen arbitrarias y existen para evitar un error concreto.

## Arquitectura

**Un único archivo HTML, sin framework ni compilación.** Se abre con doble clic,
funciona sin conexión, se publica en GitHub Pages sin paso de build y un alumno
puede descargarlo y usarlo en cualquier máquina. Las únicas dependencias
externas son las tipografías IBM Plex Sans y Mono de Google Fonts, con
tipografías del sistema como respaldo.

**No migrar a React ni a Next (evaluado en septiembre de 2026).** Next no aporta
nada: no hay servidor, rutas, cuentas ni contenido que indexar. React
ordenaría el renderizado, pero obliga a tener un paso de compilación y
dependencias, y el problema real del código es el estado global disperso, que se
puede resolver sin cambiar de tecnología. El orden acordado fue:

1. Llevar los tests al repositorio, para poder refactorizar con red. *(Hecho.)*
2. Consolidar el estado global en un solo objeto con una única función de
   renderizado.

Vale la pena revisar la decisión si se agrega un servidor (cuentas, envío de
resultados de los alumnos), si se suman más personas al desarrollo o si, aun
con el estado consolidado, los errores de sincronización de la interfaz siguen
siendo frecuentes.

**El motor es puro y produce una traza.** `simular(ps, devs, cfg)` no toca la
página: devuelve `pasos[]` con una instantánea completa por instante, además de
las líneas de tiempo y las métricas. La interfaz sólo dibuja `sim.pasos[paso]`.
Esto permite retroceder sin re-simular, comparar políticas sobre el mismo reloj,
corregir los desafíos re-simulando y probar el motor desde Node.

**`index.html` es la fuente del proyecto.** `simulador.html` es el mismo
contenido sin `<html>`, `<head>` ni `<body>`, que es el formato que exige la
publicación como artifact de Claude. Es un derivado y no se versiona: se
regenera con `npm run fragmento`, y `node herramientas/html.js index` hace la
conversión inversa para quien haya editado el fragmento.
*Test:* `herramientas html: index.html → fragmento → index.html es exacto`.

**Los tests leen `index.html`, no una copia del motor.** El cargador
([`tests/cargar-motor.js`](tests/cargar-motor.js)) extrae las funciones por
nombre y las ejecuta en un contexto aislado de Node, así que siempre prueban la
versión publicada. Si se renombra una de las funciones que busca, falla
diciendo cuál: hay que actualizar el cargador, no esquivarlo. No hay
dependencias: se usa `node:test`.

## Modelo de procesos y dispositivos

- Un proceso es una secuencia de fases de CPU y de E/S, cada una con su
  duración; cada fase de E/S indica su dispositivo.
- Límites de la interfaz: hasta 6 procesos, 3 dispositivos y duración 40 por
  fase (`MAXP`, `MAXD`, `MAXDUR`).
- Cada dispositivo es **un servidor con cola FIFO y sin expropiación**: el que
  empieza un servicio lo termina. Por eso un proceso bloqueado puede estar en
  dos estados distintos, `esperaES` (en la cola del dispositivo) y `usandoES`,
  y el diagrama los dibuja distinto.
- La espera en la cola de un dispositivo es **espera de E/S, no de CPU**. La
  columna *Esp. total* suma las dos para que se cumpla la identidad
  `retorno = CPU + E/S + espera de CPU + espera de E/S`, que un alumno puede
  verificar a mano.
  *Test:* `identidad de métricas`.
- El tiempo restante de un proceso baja también mientras usa un dispositivo.
  Antes no bajaba y el panel de estados contradecía al de dispositivos.
  *Test:* `dispositivos: servicio igual a lo pedido, exclusión mutua y restante coherente`.

## Convenciones de planificación

La versión para alumnos está en la aplicación, bajo las métricas
(*Convenciones que usa este simulador*), y un resumen en el README. Si una
cambia, hay que actualizar los tres lugares.

**Orden dentro de un instante.** Primero se encolan en listos los procesos que
terminan su E/S y después las llegadas nuevas. En Round Robin, cuando en el
mismo instante llega un proceso y otro agota su quantum, el orden es
configurable (`emp`): por defecto, `llegadas`, entran primero las llegadas y
después el desalojado; la alternativa es `desalojado`. Es la convención que
más varía entre libros, y por eso se deja elegir.

**Empates.** En SJF, SRTF y las políticas por prioridad gana el que lleva más
tiempo en la cola de listos.

**SJF compara la ráfaga de CPU actual**, no la suma de todas las del proceso:
es lo único que el planificador podría estimar.

**SRTF expropia al comienzo de cada unidad de tiempo, y sólo si el candidato
tiene un restante estrictamente menor.** Con "menor o igual" un empate causaría
un cambio de contexto sin beneficio.

**Round Robin reinicia el quantum completo en cada despacho**, también cuando el
proceso vuelve de E/S. Precisamente ese es el castigo al proceso ligado a E/S
que motiva VRR.
*Test:* `el caso resuelto a mano: FCFS, SJF, SRTF y Round Robin`.

### Costo del cambio de contexto

- Se cobra al despachar un proceso **distinto del último que usó la CPU**. No
  se cobra en el primer despacho del lote ni cuando un proceso retoma la CPU sin
  que otro la haya usado en el medio.
- En los datos del motor el cambio ocupa la CPU con el marcador `SO = '#cambio'`.
- **Es atómico**: la decisión se toma al empezar y no se revisa hasta terminar,
  ni siquiera en SRTF. El proceso elegido sigue *listo* mientras dura, así que
  esas unidades cuentan como espera suya.
- **Un proceso recién despachado ejecuta al menos una unidad antes de poder ser
  expropiado** (`reciCargado` en el motor). Sin esta regla, con costo de cambio
  y envejecimiento en Prioridad expropiativa el sistema entraba en un bucle:
  cambiaba de contexto indefinidamente sin avanzar ningún proceso.
- Con costo 0 no cambia nada respecto de la versión sin costo.

*Tests:* `costo de cambio de contexto`, `la curva del quantum sobre el lote con CPU disputada, con costo 1`.

### Prioridades y envejecimiento

- El número más bajo es el más urgente; el rango es 0 a 9 (`MAXPRIO`).
- El envejecimiento mejora un nivel cada N unidades de espera y **cuenta sólo
  la espera en la cola de listos**, no la de E/S: lo que corrige es la
  inanición de CPU.
- La prioridad mejorada **vuelve a su valor base en cuanto el proceso toma la
  CPU**, para que la promoción no se acumule indefinidamente.
- La instantánea de cada instante se registra **antes** de aplicar el
  envejecimiento de ese instante. Antes era al revés y el panel mostraba una
  prioridad con la que el proceso todavía no había competido.

*Test:* `prioridades y envejecimiento`.

### VRR

- Sólo entran en la cola auxiliar los procesos que vuelven de E/S **con quantum
  pendiente**. El que agota su quantum, o termina su ráfaga justo al agotarlo,
  vuelve a la cola de listos común.
- La cola auxiliar se atiende entera, en orden FIFO, antes que la de listos.
- Desde la auxiliar se recibe sólo el remanente. Si el proceso vuelve a
  bloquearse antes de consumirlo, el nuevo remanente se calcula **contra la
  porción que se le otorgó**, no contra el quantum completo: de lo contrario un
  proceso que recibe 1 unidad y la usa entera saldría con más crédito del que
  tenía.
- El proceso despachado desde la auxiliar sale de ella en ese mismo instante,
  y en la instantánea la cola quedaría vacía justo cuando hay algo que mostrar.
  Por eso el motor lo marca aparte (`auxDesp`) y la interfaz lo dibuja como
  *quantum n → a la CPU*.
- Sin E/S, VRR produce exactamente el diagrama de Round Robin.

*Tests:* `VRR: la cola auxiliar sólo contiene procesos listos con quantum pendiente`, `VRR sin E/S produce exactamente el diagrama de Round Robin`.

## Línea de tiempo

- La fila de cada proceso muestra **su uso de recursos**: sólido en CPU,
  rayado diagonal usando un dispositivo, rayado vertical fino en la cola de un
  dispositivo. La espera en listos queda como hueco. La primera versión
  pintaba también la espera en listos y el diagrama se leía al revés.
- Un triángulo marca la llegada (hacia arriba, borde inferior) y otro el fin
  (hacia abajo, borde superior).
- Al cargar, el diagrama se dibuja en el instante 0, no vacío.
- *Comparar quantums* sólo aparece con las políticas que usan quantum (Round
  Robin y VRR). El barrido es sobre Round Robin con quantum 1, 2, 4 y 8.

## Interfaz

- **Pestañas Simulación y Desafío** arriba de todo. El desafío cambia la
  interfaz entera, así que no podía ser un botón dentro del panel del diagrama.
- **Distribución:** el panel de estados de los procesos va al lado del de
  dispositivos, y *Qué pasa en este instante* debajo de los dos.
- **Limpiar el lote** es un ícono de cesto arriba a la derecha, a la altura del
  título *Lote de procesos*, con `title` y `aria-label`. Se probó un tooltip
  propio y se descartó: se prefirió el comportamiento nativo del navegador.
- **Campos editables con fondo propio** (`--field`, blanco en tema claro) y
  campos inactivos o de sólo lectura con `--field-off`, más gris. Con un único
  fondo gris los campos editables parecían deshabilitados. Los campos ya
  corregidos (`.leer-ok`, `.leer-mal`) conservan su color de corrección.
- **Tema claro y oscuro** con tokens en `:root`, redefinidos para
  `prefers-color-scheme: dark` y para `data-theme`, así la preferencia explícita
  gana en las dos direcciones.

## Desafío: Predecir decisiones

- **Se pregunta con la instantánea previa a la decisión** (`pa.pre`). La
  instantánea del instante ya muestra al elegido ejecutando, y revelaba la
  respuesta.
  *Test:* `modo Predecir: cada decisión guarda el estado previo y su respuesta es una de las opciones`.
- **Qué instantes se preguntan:** todo instante en que el planificador decide,
  salvo los de CPU ociosa sin nadie bloqueado, que son triviales. *Sólo las
  disputadas* descarta además los de un único candidato; una CPU ociosa con
  procesos bloqueados sí se pregunta, porque la tentación es elegir a alguien.
  *Test:* `modo Predecir: el lote con E/S tiene 15 preguntas, 11 de ellas disputadas`.
- **La simulación avanza con la respuesta correcta**, no con la del alumno, para
  que un error temprano no arrastre todas las decisiones siguientes.
- **Segunda pregunta** sólo cuando la política la amerita: en VRR, cuántas
  unidades recibe el proceso despachado desde la auxiliar; con envejecimiento,
  con qué prioridad efectiva compitió. Mientras está pendiente se retiene la
  justificación de la primera, que contendría la respuesta.
- El puntaje se cuenta sobre respuestas dadas, incluidas las segundas
  preguntas. Contarlo sobre instantes producía resultados como "8 de 6".
- **El lote generado vive sólo dentro del desafío** y nunca reemplaza al de
  Simulación. Se eligió así frente a la alternativa de reemplazarlo, que hacía
  perder el lote propio del alumno.
- Al generar se elige la política, al azar o una en particular. **La semilla fija
  el lote independientemente de la política**: la política sale de otra
  corriente pseudoaleatoria (`${semilla}|politica`), así cada alumno puede
  practicar una política distinta sobre el mismo lote.
  *Test:* `Predecir: la semilla fija el lote aunque cambie la política`.
- Los paneles de Predecir leen la configuración del desafío (`ctx()`), no la de
  Simulación. Antes mostraban la política de la otra pestaña.

## Desafío: Leer el diagrama

### Niveles

| Nivel | Políticas | Procesos | E/S | Garantía |
|---|---|---|---|---|
| Fácil | FCFS, SJF | 3 a 4 | no | ningún proceso aparece partido |
| Medio | SRTF, RR | 3 a 5 | no | al menos una ráfaga partida por expropiación |
| Difícil | las siete | 3 a 5 | sí | al menos dos procesos con E/S |

- Siguen el orden en que se da la materia. En todos hay al menos 2 unidades de
  espera total, para que el ejercicio no sea trivial.
- Los niveles sin E/S no tienen dispositivos, para no dibujar filas vacías. El
  difícil usa siempre *Disco* e *Impresora*.
- El generador sortea ráfagas de CPU de 2 a 6, E/S de 2 a 5 (probabilidad 0,7
  por proceso en el difícil) y quantum de 2 a 4, sin costo de cambio ni
  envejecimiento. Si un intento no cumple las garantías prueba con subsemillas
  `${semilla}#1`, `#2`… hasta 80; si ninguno cumple, devuelve el último. Con
  las semillas de los tests nunca ocurre, pero no está descartado.
  *Tests:* `cada nivel cumple sus garantías`, `los generadores son deterministas`, `el generador de desafíos es rápido`.

### Semillas

- La misma semilla con el mismo nivel produce siempre el mismo diagrama.
- **Nuevo diagrama** genera una semilla al azar si el campo está vacío **o
  todavía tiene la semilla del diagrama vigente**; si el alumno escribió otra,
  usa esa (`semillaPedida`). Antes había que borrar el campo para obtener un
  diagrama nuevo. Enter en el campo equivale al botón. Lo mismo vale para
  *Generar lote* en Predecir.
- Cambiar de nivel conserva la semilla escrita.

### Métricas

Los promedios admiten dos decimales, con punto o con coma.

### Reconstruir el lote

- **Se corrige re-simulando**, no campo por campo: el lote del alumno se simula
  con la política que produjo el diagrama y es correcto si lo reproduce
  exactamente, aunque difiera del original.
  *Test:* `cada desafío se puede reconstruir leyendo sólo el diagrama`.
- Si no lo reproduce, cada campo se marca contra el lote original como ayuda. La
  duración y el dispositivo de una E/S se marcan por separado: antes un error
  de duración pintaba de rojo también el dispositivo correcto.
- Cada proceso arranca con una sola ráfaga de CPU, para no revelar cuántas E/S
  tiene.
- **No se piden la prioridad ni el quantum**: la prioridad no se ve en un
  diagrama y el quantum es parte de la política. Para re-simular se usan los
  del lote original.
- Una parte que se deja vacía no se corrige; un campo inválido se informa como
  tal.

*Test:* `corrección del lote por re-simulación`.

### Identificar la política

- **La respuesta es un conjunto**: una política es correcta si, corrida sobre el
  lote, reproduce el diagrama. Marcar una de más o dejar afuera una que lo
  produce son errores.
- **El generador sólo acepta diagramas que discriminan**: una política posible
  en fácil y medio, a lo sumo dos en difícil. Con prioridades adecuadas,
  Prioridad imita a FCFS o a SJF; por eso en el difícil las prioridades se
  muestran como dato del lote, como en un enunciado de parcial.
  *Test:* `los diagramas discriminan`.
- **El quantum se corrige simulando el valor escrito**: cualquier quantum que
  reproduzca el diagrama es correcto. El análisis previo prueba de 1 a 7
  (`QMAX`), pero un valor mayor, por ejemplo 12, también se acepta si
  reproduce el diagrama. Olvidar el quantum es un error.
- Cada política que no reproduce el diagrama muestra el primer instante en que
  se aparta, por ejemplo *en t=4 le da la CPU a P2, pero en el diagrama la tiene
  P3*.

*Test:* `corrección de la identificación de la política`.

## Abrir en Simulación

- Aparece **sólo al terminar** un desafío, porque antes revelaría las
  respuestas.
- Lleva el lote y la política del desafío a la pestaña Simulación. Como eso
  reemplaza el lote propio, el anterior se guarda en `localStorage`
  (`planif2_previo`) y un aviso permite recuperarlo, también después de
  recargar la página.
- Si el lote del desafío no tiene E/S, se conservan los dispositivos que ya
  había en Simulación. Antes quedaban vacíos y agregar una E/S rompía la
  página.

## Publicación

- **GitHub Pages** sirve `index.html` desde la rama `main` de
  `levicot/iso-planificacion-cpu`.
- **Artifact de Claude:** se publica `simulador.html`, generado con
  `npm run fragmento`.
- La carpeta [`diseno/`](diseno) contiene el lienzo de Claude Design con las
  maquetas de la interfaz (principal, comparación y móvil). Es material de
  referencia y no forma parte de la aplicación.

## Tests

Se corren con `npm test` (o `node --test`), con Node 20 o posterior y sin
instalar nada. Cubren:

- **Motor:** el caso resuelto a mano, la identidad de métricas y los invariantes
  de dispositivos, costo de cambio, prioridades, envejecimiento y VRR, sobre
  los cuatro lotes de ejemplo y todas las políticas.
- **Valores de referencia:** los números que citan el README y la aplicación.
  Si un cambio los modifica a propósito, hay que actualizar el test y el
  README juntos.
- **Desafíos:** determinismo y garantías de los generadores, reconstrucción,
  corrección del lote y de la identificación de la política.

Todo cambio en el motor, en los generadores o en la corrección se acompaña con
un test que lo cubra.
