# Planificador paso a paso

**▶ [Abrir el simulador](https://levicot.github.io/iso-planificacion-cpu/)**

Simulador visual de algoritmos de planificación de procesos para la materia
**Introducción a Sistemas Operativos**. Los alumnos definen un lote de procesos
con sus ráfagas de CPU y sus pedidos de E/S, eligen una política y avanzan el
reloj de a una unidad de tiempo para ver qué decide el planificador y por qué.

## Qué simula

**Políticas de CPU**

| Política | Expropiación | Criterio |
|---|---|---|
| FCFS | No | Orden de llegada |
| SJF | No | Ráfaga de CPU más corta |
| SRTF | Sí | Menor tiempo restante |
| Prioridad | No | La más urgente primero |
| Prioridad expropiativa | Sí | La más urgente primero |
| Round Robin | Sí (por quantum) | Turno rotativo, quantum configurable |
| VRR | Sí (por quantum) | Round Robin virtual, con cola auxiliar |

En las políticas por prioridad el número más bajo es el más urgente, y el
**envejecimiento** mejora un nivel cada N unidades esperando la CPU (0 lo
apaga). El lote **con inanición** está armado para mostrarlo: P2 llega en t=1
con la peor prioridad y una corriente de procesos urgentes lo posterga hasta
t=15 — espera 14 unidades. Con envejecimiento cada 2 unidades entra en t=9 y
su espera baja a 8, mientras la espera media del lote sube de 3.00 a 3.67:
el intercambio entre equidad y promedio, en dos números. Con factor 3 o 4 el
envejecimiento no alcanza, que también es una lección.

**VRR (Round Robin virtual).** Funciona como Round Robin, pero los procesos
que vuelven de E/S **con quantum pendiente** entran en una cola auxiliar que
tiene prioridad sobre la de listos, y al ser despachados desde ella reciben
sólo lo que les quedó sin usar del quantum anterior. Corrige el castigo que RR
le impone al proceso ligado a E/S, que agota una fracción mínima de su quantum
y aun así vuelve al final de la cola. En el lote **ligado a E/S** con quantum 3,
la espera media baja de 5.00 a 2.33: los dos procesos con E/S mejoran 3 y 6
unidades, el ligado a CPU paga 1. Sin ráfagas de E/S, VRR produce exactamente
el mismo diagrama que RR.

**Costo del cambio de contexto.** Configurable, 0 por defecto. Con un costo
mayor que cero, cada despacho de un proceso distinto del último que usó la CPU
inserta una franja de sobrecarga en la que la CPU no avanza ningún proceso.
Es lo que permite ver por qué un quantum chico es caro: sobre el lote con CPU
disputada y costo 1, Round Robin con quantum 1 gasta el 48 % del tiempo
cambiando de contexto, y con quantum 8 degenera exactamente en FCFS.

**Dispositivos de E/S.** Hasta tres dispositivos con nombre. Cada uno atiende a
un proceso por vez con su propia cola FIFO, así que un proceso bloqueado puede
estar *esperando el dispositivo* o *usándolo*, y el diagrama los distingue.

## Modos de comparación

La pestaña **Simulación** tiene tres modos de línea de tiempo: un algoritmo
paso a paso y dos de comparación. En **Comparar políticas**, todas las
políticas resuelven el mismo lote sobre un reloj compartido: se ve una franja
de ocupación de CPU por algoritmo, todas en la misma escala, y una tabla con
espera media, peor espera individual, respuesta, retorno, cambios de contexto
y tiempo total, resaltando el mejor valor de cada columna.

En **Comparar quantums** el barrido es sobre Round Robin con quantum 1, 2, 4
y 8. Junto con el costo del cambio de contexto es donde se ve la curva
completa: sobre el lote con CPU disputada y costo 1, el quantum 1 consigue la
mejor respuesta media (3.60 contra 10.60) y pierde en todas las demás
columnas, mientras que el quantum 8 produce exactamente los números de FCFS.

## Lotes de ejemplo

- **Lote con E/S** — pocos procesos, ráfagas de E/S largas y dos dispositivos.
  Sirve para enseñar colas de dispositivo, bloqueo y CPU ociosa.
- **Lote con CPU disputada** — cinco procesos que llegan casi juntos, sólo CPU.
  Sirve para comparar políticas: se ve el efecto convoy en FCFS, la inanición
  del proceso largo en SRTF y el intercambio de Round Robin entre respuesta y
  cambios de contexto.
- **Lote con inanición** — seis procesos con prioridades y llegadas escalonadas.
  Sirve para ver la inanición por prioridad y cómo la corrige el envejecimiento.
- **Lote ligado a E/S** — dos procesos de ráfagas cortas con mucha E/S y uno
  puramente de CPU. Sirve para comparar RR contra VRR.

## Cómo se lee la línea de tiempo

Arriba, una fila por recurso (la CPU y cada dispositivo) muestra quién lo ocupa
en cada instante. Abajo, una fila por proceso muestra su ocupación de recursos:

- **Sólido** — usando la CPU
- **Rayado diagonal** — usando un dispositivo
- **Rayado vertical fino** — en la cola de un dispositivo, bloqueado sin usarlo
- **Hueco** — sin recursos: listo esperando la CPU, aún no llegó, o ya terminó

Sobre la fila de cada proceso, dos marcas acotan su vida: un triángulo hacia
arriba en el borde inferior marca el instante en que **llega** al sistema, y
uno hacia abajo en el borde superior el instante en que **termina**.

## Convenciones de desempate

Están listadas en la aplicación, bajo las métricas. Las que más suelen generar
discusión:

- La cola de cada dispositivo es FIFO; al liberarse toma al primero de su cola
  en ese mismo instante.
- El tiempo en la cola de un dispositivo cuenta como espera de E/S, no de CPU.
  La columna `Esp. total` suma las dos esperas, de modo que
  `retorno = CPU + E/S + espera total`.
- En un mismo instante se encolan primero los que terminan su E/S y después las
  llegadas nuevas.
- En SJF y SRTF, ante un empate gana el que lleva más tiempo en la cola.
- SJF compara la ráfaga de CPU actual, no la suma de todas las del proceso.
- En Round Robin, si en el mismo instante llega un proceso y otro agota su
  quantum, el orden es configurable desde la interfaz.
- El costo del cambio de contexto se cobra al despachar un proceso distinto del
  último que usó la CPU: nunca en el primer despacho del lote, ni cuando un
  proceso retoma la CPU sin que otro la haya usado en el medio.
- El cambio es atómico —ni SRTF lo interrumpe— y el proceso elegido sigue listo
  mientras dura, así que esas unidades cuentan como espera suya.

## Desafío

La pestaña **Desafío** invierte la herramienta: en vez de mostrar
la respuesta, la pregunta. En cada instante en que el planificador tiene que
elegir, oculta el panel de eventos y las métricas y pregunta **qué proceso toma
la CPU**, ofreciendo los procesos elegibles más la opción *ninguno, la CPU queda
ociosa*. Los paneles de definición se colapsan a un resumen de sólo lectura; la
cola de listos, los dispositivos y el estado de cada proceso siguen visibles,
porque son la información con la que hay que razonar.

Tras responder aparece la justificación que el simulador ya calculaba, y **la
simulación avanza con la respuesta correcta, no con la del alumno**: así un
error temprano no arrastra todas las decisiones siguientes. Al terminar se
muestra el puntaje, la lista de errores con su explicación, y recién ahí las
métricas del lote.

El selector elige entre preguntar **todas las decisiones** o **sólo las
disputadas** —aquellas con más de un candidato—, que sobre el lote con E/S son
15 y 11 respectivamente.

Cuando la política lo amerita aparece una **segunda pregunta**, y sólo entonces:
en VRR, por cuántas unidades recibe la CPU el proceso despachado desde la cola
auxiliar —donde el error clásico es contestar el quantum completo—; con
prioridades y envejecimiento, con qué prioridad efectiva compitió, donde el
error clásico es contestar la prioridad base. Mientras esa pregunta está
pendiente se retiene la justificación de la primera, que contendría la
respuesta.

Se puede practicar con el lote de la pestaña Simulación o con uno **generado**,
que vive sólo dentro del desafío y nunca reemplaza al de Simulación. Al generar
se elige la **política**: al azar o una en particular. La semilla fija el lote
independientemente de la política, así que con una misma semilla cada alumno
puede practicar una política distinta sobre exactamente el mismo lote. El botón
*Usar mi lote de Simulación* vuelve al lote propio.

### Leer el diagrama

El segundo tipo de desafío muestra un diagrama completo generado al azar, sin
el lote que lo produjo, y pide calcular las métricas de cada proceso y sus
promedios leyendo el gráfico: las marcas de llegada y fin, los bloques de CPU y
las esperas. Los promedios admiten dos decimales, con punto o con coma. Al
corregir se marca cada celda, se muestra el valor correcto donde hubo error y se
revela qué algoritmo produjo el diagrama.

Tiene tres niveles, que siguen el orden en que se da la materia:

| Nivel | E/S | Expropiación | Algoritmos posibles |
|---|---|---|---|
| Fácil | no | no | FCFS, SJF |
| Medio | no | sí | SRTF, RR |
| Difícil | sí | sí | los siete |

El generador garantiza lo que promete cada nivel: en el fácil ningún proceso
aparece partido, en el medio siempre hay al menos una ráfaga partida por una
expropiación, en el difícil al menos dos procesos hacen E/S, y en todos hay
espera suficiente para que el ejercicio no sea trivial. La misma semilla con el
mismo nivel produce siempre el mismo diagrama. El lote generado no reemplaza al
de la pestaña Simulación.

#### Reconstruir el lote

En la misma pantalla, antes de las métricas, el desafío pide reconstruir el
lote: cuándo llega cada proceso y su secuencia de ráfagas de CPU y de E/S, con
su dispositivo. Cada proceso arranca con una sola ráfaga de CPU, para no
revelar cuántas E/S tiene.

No se corrige comparando campo por campo sino **re-simulando**: el lote del
alumno se simula con la misma política que produjo el diagrama, y es correcto
si lo reproduce exactamente, aunque difiera del original. Si no lo reproduce,
cada campo se marca contra el lote original y se muestra la secuencia que
correspondía, como ayuda para encontrar el error.

La prioridad no se puede leer en un diagrama, así que no se pide: para
re-simular se usa la del lote original. El quantum tampoco se pide, porque es
parte de la política. Cualquiera de las dos partes, lote o métricas, se puede
dejar vacía y no se corrige.

#### Identificar la política

La tercera parte pide marcar qué políticas producen el diagrama. La respuesta es
un conjunto: una política es correcta si, corrida sobre el lote, reproduce el
diagrama exactamente. Para Round Robin y VRR también se pide el quantum, y se
corrige simulando con el quantum que se escribió, así que cualquier valor que
reproduzca el diagrama cuenta como correcto. Al corregir, cada política dice si
lo produce y, si no, el primer instante en que se aparta, por ejemplo: *en t=4
le da la CPU a P2, pero en el diagrama la tiene P3*.

Para que la pregunta no sea trivial, el generador sólo acepta diagramas que
discriminan: en los niveles fácil y medio una sola de las políticas posibles
los produce, y en el difícil como máximo dos. Como las prioridades no se ven en
un diagrama —con las prioridades adecuadas, Prioridad imita a FCFS o a SJF—, en
el nivel difícil se muestran como dato del lote, igual que en un enunciado de
parcial.

### Abrir en Simulación

Al terminar cualquiera de los dos desafíos aparece **Abrir en Simulación**, que
lleva el lote y la política del desafío a la pestaña Simulación para recorrerlo
paso a paso y ver dónde estuvo el error. Sólo aparece al final, porque antes
revelaría las respuestas. Como abrirlo reemplaza el lote de Simulación, el lote
anterior queda guardado —también si se recarga la página— y un aviso permite
recuperarlo.

## Compartir ejercicios

El botón **Compartir este ejercicio** genera un código con el lote completo.
El docente lo reparte y el alumno devuelve el suyo: no hace falta servidor ni
cuentas de usuario.

## Uso local

Es un único archivo sin dependencias ni compilación. Descargá `index.html` y
abrilo con doble clic. Funciona sin conexión (sin internet usa la tipografía
del sistema en lugar de IBM Plex).

## Atajos de teclado

`←` `→` un paso · `espacio` reproducir o pausar · `inicio` `fin` a los extremos

## Desarrollo

La aplicación entera está en `index.html`. Las convenciones del simulador, las
alternativas descartadas y el porqué de cada regla están en
[DECISIONES.md](DECISIONES.md): conviene leerlo antes de cambiar el motor.

Los tests no necesitan instalar nada, sólo Node 20 o posterior:

```bash
npm test
```

Leen las funciones directamente de `index.html`, así que prueban la versión que
se publica. Cubren el motor (un caso resuelto a mano, la identidad de métricas y
los invariantes de dispositivos, cambio de contexto, prioridades y VRR), los
números que cita este README, y los generadores y la corrección de los
desafíos.

Para publicar como artifact de Claude hace falta la versión sin `<html>`,
`<head>` ni `<body>`, que se genera con `npm run fragmento`.
