# Verificación del port

Las claves y baremos de los 5 instrumentos son datos psicométricos validados.
El port a JavaScript no se valida leyéndolo: se valida exigiendo que devuelva
exactamente lo mismo que el motor Python en producción.

```bash
python3 dump-referencia.py      # planillas reales + bordes + 500 sintéticas
python3 dump-celdas.py          # celdas crudas de las planillas reales
python3 dump-docx.py            # informes completos generados por el motor
node verificar-port.js          # Correccion.gs contra la referencia
node verificar-lectura.js       # Lectura.gs contra la referencia, y punta a punta
node verificar-documento.js     # Documento.gs contra los informes de Python
node verificar-radar.js         # Radar.gs: serie graficada y armado del gráfico
node verificar-orquestador.js   # Informe.gs: flujo completo contra Drive simulado
node verificar-webapp.js        # WebApp.gs: acceso, listados y calificaciones
node verificar-metricas.js      # Metricas.gs: los números del tablero
```

Los cuatro verificadores de la app (`orquestador`, `webapp`, `metricas` y
`radar`) no necesitan volcados de Python: corren sin haber ejecutado nada antes.

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

## Verificar el armado del informe

Comparar dos `.docx` byte a byte no diría nada. `dump-docx.py` genera el informe
con el motor Python y vuelca su **estructura**: el orden de párrafos y tablas, el
texto de cada tramo con su formato (negrita, cursiva, tamaño, color) y el
sombreado de cada celda. `verificar-documento.js` corre `Documento.gs` contra un
`DocumentApp` simulado (`stub-documentapp.js`) y exige la misma estructura,
bloque por bloque.

El stub sólo implementa lo que el port usa. Si mañana `Documento.gs` empieza a
usar otra parte de la API, ahí va a fallar — que es justo lo que se busca:
enterarse antes de subirlo, no después.

Las 3 planillas reales no alcanzan: no recorren las secciones condicionales ni
los 25 textos de NEO. Por eso `dump-docx.py` también escribe planillas
sintéticas de verdad y las hace pasar por el motor completo, incluyendo perfiles
que apuntan a un puntaje NEO exacto y un perfil sin brechas (el único que
dispara los textos de respaldo). Con 29 informes quedan cubiertos los 25 textos
de NEO, los 6 objetivos y las dos ramas de respaldo.

## Verificar el radar

Acá no hay motor Python que replicar pixel a pixel: el gráfico cambia de
tecnología a propósito. Lo que se verifica es lo que sí tiene que ser idéntico
—los 14 ejes, sus etiquetas y los dos valores de cada uno— más el armado del
gráfico contra servicios simulados de Sheets y Drive: tipo RADAR, escala fija
0-100, los colores institucionales, y que la planilla temporal se descarte
siempre, incluso si la exportación falla.

Que el dibujo se vea bien no lo decide un test. Eso ya se comparó visualmente
contra el gráfico de matplotlib y está aprobado, con las pérdidas asumidas que
figuran en la sección 4 del plan.

## Verificar el orquestador

El riesgo del orquestador no son las cuentas —eso ya está verificado pieza por
pieza— sino el orden de las operaciones, lo que crea en Drive y **lo que deja
tirado cuando algo sale mal**. Se prueba contra servicios de Google simulados
que registran lo que se les pidió: el camino feliz, la planilla en blanco, el
usuario fuera del grupo, el grupo que no se puede consultar, el proyecto sin
configurar y la exportación que falla. En todos los caminos de error se exige
que no quede nada a medio crear y que la corrida no se registre.

## Salvedades

- `referencia-python.json`, `celdas-python.json` y `documento-python.json` están
  en `.gitignore`: contienen las respuestas crudas y los informes completos de
  personas evaluadas reales. Se regeneran.
- El modelo `.docx` de referencia es `MODELO DE INFORME 2.docx`, no
  `MODELO DE INFORME.docx`: este último no trae el estilo `Normal Table` y el
  motor Python falla con él.
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
