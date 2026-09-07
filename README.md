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
| Round Robin | Sí (por quantum) | Turno rotativo, quantum configurable |

**Dispositivos de E/S.** Hasta tres dispositivos con nombre. Cada uno atiende a
un proceso por vez con su propia cola FIFO, así que un proceso bloqueado puede
estar *esperando el dispositivo* o *usándolo*, y el diagrama los distingue.

## Cómo se lee la línea de tiempo

Arriba, una fila por recurso (la CPU y cada dispositivo) muestra quién lo ocupa
en cada instante. Abajo, una fila por proceso muestra su ocupación de recursos:

- **Sólido** — usando la CPU
- **Rayado diagonal** — usando un dispositivo
- **Rayado vertical fino** — en la cola de un dispositivo, bloqueado sin usarlo
- **Hueco** — sin recursos: listo esperando la CPU, aún no llegó, o ya terminó

## Convenciones de desempate

Están listadas en la aplicación, bajo las métricas. Las que más suelen generar
discusión:

- La cola de cada dispositivo es FIFO; al liberarse toma al primero de su cola
  en ese mismo instante.
- El tiempo en la cola de un dispositivo cuenta como espera de E/S, no de CPU.
  Por eso `retorno = CPU + E/S + espera CPU + espera E/S`.
- En un mismo instante se encolan primero los que terminan su E/S y después las
  llegadas nuevas.
- En SJF y SRTF, ante un empate gana el que lleva más tiempo en la cola.
- SJF compara la ráfaga de CPU actual, no la suma de todas las del proceso.
- En Round Robin, si en el mismo instante llega un proceso y otro agota su
  quantum, el orden es configurable desde la interfaz.

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
