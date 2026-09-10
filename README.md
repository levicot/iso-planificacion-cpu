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

El campo de **semilla** genera un lote al azar de forma reproducible: la misma
semilla produce siempre el mismo lote. El docente reparte semillas distintas y
cada alumno recibe un ejercicio diferente pero comparable, que el docente puede
regenerar para corregir.

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
