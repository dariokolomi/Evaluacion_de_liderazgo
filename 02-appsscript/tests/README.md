# Verificación del port

Las claves y baremos de los 5 instrumentos son datos psicométricos validados.
El port a JavaScript no se valida leyéndolo: se valida exigiendo que devuelva
exactamente lo mismo que el motor Python en producción.

```bash
python3 dump-referencia.py      # planillas reales + bordes + 500 sintéticas
node verificar-port.js          # compara Correccion.gs contra esa referencia
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

## Salvedades

- `referencia-python.json` está en `.gitignore`: pesa ~9 MB y contiene las
  respuestas crudas de personas evaluadas reales. Se regenera cuando hace falta.
- `Planilla de Preguntas (1).xlsx` no se procesa: es el formulario en blanco,
  sin respuestas cargadas. El motor Python también falla con ella (`KeyError: 1`).
- Algunas filas de los baremos son inalcanzables por construcción — cortes
  repetidos entre percentiles contiguos (Carisma P95 y P90 comparten el corte
  4,75) o cortes que ninguna media puede alcanzar (Consideración Individualizada
  son 3 ítems: la media 14/3 = 4,6667 nunca llega al corte 4,67 de P75). El port
  reproduce ese comportamiento porque copia las tablas tal cual; no es algo que
  se corrija acá.
