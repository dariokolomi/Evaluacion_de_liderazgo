# Verificación del port

Las claves y baremos de los 5 instrumentos son datos psicométricos validados.
El port a JavaScript no se valida leyéndolo: se valida exigiendo que devuelva
exactamente lo mismo que el motor Python en producción.

```bash
python3 dump-referencia.py      # planillas reales + bordes + 500 sintéticas
python3 dump-celdas.py          # celdas crudas de las planillas reales
node verificar-port.js          # Correccion.gs contra la referencia
node verificar-lectura.js       # Lectura.gs contra la referencia, y punta a punta
```

Para una corrida más exigente: `python3 dump-referencia.py --fuzz 2000`.

## Cómo funciona

`dump-referencia.py` **no reimplementa la corrección**. Recorta de
`01-legacy-python/run_engine.py` el bloque que va de la lectura de la planilla
al vector del radar y lo ejecuta tal cual. Si el motor cambia, la referencia
cambia con él; si alguien reescribe la corrección Python, el verificador lo
detecta en vez de comparar contra una copia congelada.

Los casos sintéticos alimentan ese mismo código con un libro Excel simulado en
memoria, sin generar archivos. Existen porque las planillas reales recorren muy
pocas celdas de los baremos: los errores de transcripción viven en los bordes.
Por eso hay tres fuentes de casos:

| Fuente | Para qué |
|---|---|
| Planillas reales de `compartido/instrumentos/` | El caso de uso verdadero, punta a punta |
| 4 casos de borde (todo mínimo / todo máximo) | Fuerzan las filas extremas de cada baremo |
| N casos al azar, con sesgo bajo/alto/extremo | Recorren el interior de las tablas |

La semilla del azar es fija: un fallo se reproduce corriendo lo mismo otra vez.

`verificar-lectura.js` compara las respuestas que extrae `Lectura.gs` de las
celdas crudas contra las que leyó Python, y después las corrige para comprobar
que la cadena entera da lo mismo. Cierra con casos construidos a mano —celdas
basura, encabezados que se parecen a ítems, hojas vacías— que ninguna planilla
real tiene.

## Salvedades

- `referencia-python.json` y `celdas-python.json` están en `.gitignore`:
  contienen las respuestas crudas de personas evaluadas reales. Se regeneran.
- `Planilla de Preguntas (1).xlsx` es el formulario en blanco, sin respuestas.
  El motor Python explota con ella (`KeyError: 1`); la lectura nueva la rechaza
  diciendo qué le falta. Es la única diferencia buscada respecto de Python.

## Dónde la lectura no es un calco de Python

Dos casos donde `Lectura.gs` no puede replicar a openpyxl, y qué se hizo:

| Caso | Python | Apps Script |
|---|---|---|
| Número de ítem `1.0` en vez de `1` | `isinstance(row[0], int)` lo descarta | Sheets no distingue entero de decimal; se acepta todo número sin parte decimal |
| Celda de NEO con algo que no es A–E | La toma igual y después falla al puntuar | Se cuenta como ítem sin responder, para no producir un puntaje sin sentido |
- Algunas filas de los baremos son inalcanzables por construcción — cortes
  repetidos entre percentiles contiguos (Carisma P95 y P90 comparten el corte
  4,75) o cortes que ninguna media puede alcanzar (Consideración Individualizada
  son 3 ítems: la media 14/3 = 4,6667 nunca llega al corte 4,67 de P75). El port
  reproduce ese comportamiento porque copia las tablas tal cual; no es algo que
  se corrija acá.
