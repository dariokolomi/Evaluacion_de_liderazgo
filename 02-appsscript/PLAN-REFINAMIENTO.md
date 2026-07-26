# Plan de implementación — Refinamiento del PO (Refinamiento- 1.docx)

**Fecha:** 2026-07-23
**Entrada:** `Refinamiento- 1.docx` (4 HUs + checklist DoR + gaps + preguntas) y
`Diccionario - gestion por competencias martha alles.pdf` (86 páginas, 160 competencias
en 6 familias, cada una con grados A/B/C/D).
**Base:** el port a Apps Script ya terminado (`02-appsscript/*.gs`), ver `PLAN-APPSSCRIPT.md`.

> **Lo primero, en una línea:** las 4 HUs son implementables y el diagnóstico del PO es
> correcto — las contradicciones que describe existen y se pueden señalar con número de
> línea. Lo que **no** está disponible es el contenido psicométrico que las reglas
> necesitan (matriz normativa, umbrales, catálogo HRMS). Ese contenido no lo puede
> inventar el desarrollo: es una decisión profesional. El plan separa lo que se puede
> construir ya (el mecanismo) de lo que hay que esperar (la tabla que lo llena).

---

## 1. Diagnóstico: dónde está cada problema en el código actual

### HU1 — Interpretaciones basadas exclusivamente en resultados cuantitativos

El PO acierta: hay prosa fija que se emite igual cualquiera sea el resultado. No es
"texto estático" en el sentido de constante suelta — es **prosa con números
interpolados**, que es peor, porque parece derivada del dato y no lo es.

| Ubicación | Qué afirma sin mirar el dato |
|---|---|
| `Documento.gs:264` | "perfil de liderazgo **Transformacional predominante**" — siempre, aunque TransfTot sea P5 y TransTot P90. |
| `Documento.gs:268` | "con **fortalezas** en Consideración Individualizada e Inspiración. El Carisma y la Estimulación Intelectual son **zonas de crecimiento**" — reparto fijo de roles entre las 4 subescalas. |
| `Documento.gs:272` | "Dirección por Excepción y Recompensa Contingente en **niveles moderados**" — siempre "moderados". |
| `Documento.gs:276` | "Laissez-Faire: **Zona de mayor atención**" — aunque esté en P5, que es lo deseable. |
| `Documento.gs:304-308` | Sección 3 entera: "configura un perfil de **Líder Relacional-Transformacional**", "El **hallazgo más relevante** es…", "El estilo Directivo es el **menos desarrollado**" — ninguna de las tres se verifica contra los percentiles. |
| `Documento.gs:313-332` | Las 6 competencias a desarrollar son una lista fija. Se emiten las 6 siempre, con fundamentos que afirman cosas ("el menos desarrollado del perfil", "nivel moderado") que el dato puede desmentir. |
| `Documento.gs:353-355` | "Lectura del mapa": listas fijas de fortalezas y brechas. |

Lo que **sí** está bien y se conserva: `Textos.gs` → `NEO_TEXTOS` está indexado por
dimensión y nivel, y el nivel sale de `nivelPorT(T)` (`Correccion.gs:56`). Eso ya es
una regla parametrizada; le falta solo declarar su trazabilidad. Igual `Documento.gs:283`
y `:297`, que son las dos únicas condiciones reales del informe (binarias y gruesas,
pero condiciones al fin).

**Defecto adicional que HU1 vuelve bloqueante:** `Correccion.gs:198` — cuando el puntaje
directo de NEO no está en el baremo, se asume `T=50` ("Promedio"). Los baremos no cubren
todo el rango: Apertura llega hasta PD=44, así que un 45–48 (el máximo posible) se informa
como Promedio. La regla de error de HU1 dice lo contrario: *"si el valor está fuera del
rango normativo definido, el sistema debe rechazar el procesamiento"*. Ya estaba anotado
como deuda en `PLAN-APPSSCRIPT.md` §2; HU1 obliga a resolverlo.

### HU2 — Consistencia entre síntesis y brechas

La contradicción es demostrable y es exactamente la que describe el PO:

- `Documento.gs:353` imprime **siempre** "Fortalezas consolidadas: Consideración
  Individualizada (P__), Liderazgo Considerado (P__)…" — con el percentil real, aunque
  sea P10.
- `Documento.gs:364-368` lista esas mismas dimensiones como fortaleza **solo si ≥ P75**.
- Resultado: un informe puede decir en la sección 4 que la Consideración Individualizada
  es una fortaleza consolidada (P10) y no mencionarla en la sección 5.
- Simétricamente, `Documento.gs:387` puede emitir *"El perfil no presenta brechas
  significativas"* mientras `Documento.gs:354` ya imprimió *"Brechas principales:…"*.
  Es literalmente la frase que la regla de negocio de HU2 prohíbe.

**Además, los umbrales son asimétricos:** fortaleza `>= 75`, brecha `< 50`
(`Documento.gs:364` vs `:380`). La banda P50–P74 no es ni una cosa ni la otra: es muda.
Y conviven tres vocabularios de nivel distintos:

| Vocabulario | Dónde | Valores |
|---|---|---|
| Nivel por T (NEO) | `Correccion.gs:56` | Muy Alto / Alto / Promedio / Bajo / Muy Bajo |
| Nivel por percentil | `Correccion.gs:80` | Alto / Medio / Bajo |
| El que introduce el PO | Refinamiento HU1/HU4 | Fortaleza Consolidada / Zona de Crecimiento / Área de Desarrollo / Brecha Alta-Media-Baja / Riesgo |

Unificarlos es parte del trabajo, y es una decisión que necesita firma profesional.

### HU3 — Alertas de divergencia personalidad vs. conducta

No existe nada. Se construye desde cero. Es la HU más barata de las cuatro *una vez que
estén las reglas*: el motor de HU1 ya deja los datos de los 5 instrumentos en un mismo
objeto (`corregir()` en `Correccion.gs:191`), así que una regla de cruce es una condición
sobre ese objeto.

**Ambigüedad en la única regla que el PO dejó escrita:**
`IF NEO-FFI Amabilidad T ≥ 65 AND CELID-A Liderazgo Considerado ≤ P25`.
CELID-A **no tiene** una escala llamada "Liderazgo Considerado" — tiene *Consideración
Individualizada* (`CELID_ITEMS.ConsInd`). "Liderazgo Considerado (Apoyo)" es una escala de
**CAMIN-A** (`CAMIN_ITEMS.Cons`). Hay que confirmar cuál de las dos es antes de codificarla;
la regla cambia de sentido según la respuesta.

### HU4 — Salida estandarizada para HRMS

No existe. Y es la que más depende de definiciones externas. El diccionario de Martha
Alles aporta una parte del insumo, pero no todo:

| Lo que HU4 necesita | ¿Lo da el diccionario? |
|---|---|
| Enum `COMPETENCIA` | **Sí.** 160 competencias en 6 familias (cardinales, ejecutivos, intermedios, iniciales, del conocimiento, e-competences). Hay que elegir el subconjunto aplicable a liderazgo. |
| Escala para `NIVEL_BRECHA` | **Parcialmente.** El diccionario grada cada competencia en A (Alto) / B (Bueno) / C (Mínimo necesario) / D (Insatisfactorio). Sirve como escala de nivel, no como escala de *brecha*. |
| Equivalencia percentil → competencia | **No.** No hay ninguna correspondencia documentada entre las 14 dimensiones del radar (CELID/CAMIN/CONLID) y las competencias de Alles. Es la definición central que falta. |
| Catálogo `ACCION_RECOMENDADA_ID` | **No.** El diccionario describe conductas por grado, no acciones de desarrollo con identificador. |
| Contrato de campos del HRMS | **No.** Es del HRMS, no del diccionario. |

---

## 2. Arquitectura propuesta

La forma actual —lógica de interpretación embebida en el armado del documento— no soporta
ninguna de las 4 HUs: no hay dónde colgar la trazabilidad ni cómo validar consistencia
antes de publicar. La reorganización es la siguiente, y respeta la línea del proyecto
(archivos `.gs` puros, verificables en Node contra servicios simulados, cero
infraestructura nueva):

```
Correccion.gs   (sin cambios salvo el baremo fuera de rango)
      ↓ resultados numéricos
Reglas.gs       DATOS: catálogo de reglas parametrizadas, umbrales, catálogo de
                competencias y de acciones. Ningún código. Es la tabla que el
                psicólogo/PO llena y versiona.
      ↓
Motor.gs        PURO: resultados + catálogo → lista de hallazgos.
                Cada hallazgo:
                  { reglaId, instrumento, dimension, valorOrigen, tipoValor,
                    clasificacion, narrativa, versionReglas }
                Una dimensión sin regla → clasificacion:'PENDIENTE',
                narrativa:'Pendiente de definir'. Nunca se inventa.
      ↓
Consistencia.gs PURO: hallazgos → lista de inconsistencias. Si hay alguna,
                el informe no se publica.
      ↓
Documento.gs    Pasa a RENDERIZAR hallazgos. Deja de contener prosa propia:
                toda afirmación del informe viene de un hallazgo con reglaId.
Hrms.gs         hallazgos → filas {COMPETENCIA, NIVEL_BRECHA, ACCION_RECOMENDADA_ID}
Trazabilidad.gs hallazgos → pestaña del Sheet de historial (regla aplicada,
                valor, fecha, versión del catálogo).
```

Dos propiedades que esto compra y que las HUs piden explícitamente:

- **Trazabilidad (HU1, criterio "debe ser posible identificar el valor cuantitativo
  utilizado"):** sale gratis, porque el hallazgo *es* el par dato→narrativa.
- **Consistencia (HU2):** deja de ser algo que hay que "cuidar al escribir" y pasa a ser
  una invariante verificable: si dos secciones se contradicen es porque contradicen
  hallazgos, y eso lo detecta el validador.

Todo se verifica en Node con la infraestructura que ya existe en `tests/` (los módulos
puros no tocan Apps Script). Sobre el catálogo de reglas se pueden correr los mismos
perfiles sintéticos que ya se usaron para verificar el port.

---

## 3. Fases

### Fase 0 — Destrabar (no es código; es lo que bloquea todo lo demás)

Llevarle al PO / al psicólogo responsable las preguntas de la sección 4. Sin las
respuestas P0 no se puede llenar `Reglas.gs`, aunque sí se puede construir todo el
mecanismo que lo consume.

**En paralelo, y antes de agregar funcionalidad:** queda pendiente de
`PLAN-APPSSCRIPT.md` §5 *"probar el proyecto de verdad en Apps Script con una planilla
real"*. Todo el port está verificado en Node contra servicios simulados, que no prueban
que la API real se comporte igual. Construir estas 4 HUs encima de un port no probado
apila riesgo sin necesidad: son unas horas de prueba contra semanas de trabajo nuevo.

### Fase 1 — HU1: motor de reglas (P0)

1. `Reglas.gs` con la estructura del catálogo y las reglas hoy documentadas
   (los 25 textos NEO ya existentes, que son reglas válidas, más lo que llegue del PO).
   Todo lo demás entra como `PENDIENTE`.
2. `Motor.gs`: evaluador puro. Reglas ordenadas y mutuamente excluyentes por dimensión;
   la primera que matchea gana; si ninguna matchea → "Pendiente de definir".
3. Validaciones de entrada:
   - falta un resultado obligatorio → se corta (ya lo hace `Lectura.gs:143`, se conserva);
   - valor fuera del rango normativo → **se rechaza** (hoy se silencia con T=50 en
     `Correccion.gs:198`). Cambio de comportamiento: informes que hoy salen, van a
     empezar a fallar. Es lo que pide la HU, y es correcto, pero hay que avisarlo.
4. Reescribir `Documento.gs` secciones 2.2, 3 y 4 para que rendericen hallazgos.
5. Observabilidad: `Trazabilidad.gs` + pestaña nueva en el Sheet de historial.
6. Tests: cada regla del catálogo con su caso límite (justo arriba y justo abajo del
   corte), más el caso "dimensión sin regla → Pendiente de definir".

*Nota de alcance:* la sección 3 del informe (perfil integrado narrativo) es la más
difícil de derivar de reglas simples — es una síntesis, no una clasificación. Propuesta:
en esta fase se reduce a hallazgos verificables (el estilo con mayor y menor percentil,
las tensiones detectadas por reglas de cruce) y se deja fuera la prosa integradora, que
hoy es inventada. Si el PO quiere recuperar el tono narrativo, hay que definir un
constructor de síntesis (plantillas por combinación) — trabajo aparte, y conviene
discutirlo con el resultado de la Fase 1 a la vista.

### Fase 2 — HU2: consistencia (P0)

1. Umbrales únicos en `Reglas.gs`, un solo vocabulario de clasificación.
2. `Consistencia.gs` con, como mínimo, estas invariantes:
   - una dimensión clasificada Fortaleza Consolidada no puede aparecer como Zona de
     Crecimiento ni Área de Desarrollo (regla explícita de HU1);
   - si hay ≥1 brecha, está prohibida la frase "El perfil no presenta brechas
     significativas" (`Documento.gs:387`);
   - "Principales Áreas de Desarrollo" compila exactamente el conjunto de brechas, ni
     una más ni una menos;
   - toda afirmación del documento tiene `reglaId`.
3. Bloqueo de publicación: la validación corre en `Informe.gs` **antes** de
   `guardarComoDocx` (`Informe.gs:~60`), y lanza con el detalle de la inconsistencia.
4. Tests: perfiles construidos para disparar cada invariante.

### Fase 3 — HU3: alertas de divergencia (P1)

1. Reglas de cruce como datos en `Reglas.gs`: `{ id, condiciones[], severidad, texto }`.
2. Regla: si a una regla le falta un dato requerido, **no se evalúa** y se informa el
   dato faltante (no se asume, no se saltea en silencio).
3. Sección nueva en el informe, que se omite entera si no hay alertas.
4. Se implementa la única regla documentada (previa aclaración CELID vs. CAMIN); el resto
   entra cuando el psicólogo las escriba. El mecanismo queda listo.

### Fase 4 — HU4: salida HRMS (P0 para el PO, pero es la más bloqueada)

1. Extraer del PDF de Alles el subconjunto de competencias aplicables → `Reglas.gs`
   como enum de `COMPETENCIA`.
2. Tabla de equivalencia dimensión psicométrica → competencia. **La define el psicólogo.**
3. `Hrms.gs`: emite las filas normalizadas. Sin identificador obligatorio → se bloquea
   la exportación. Sin acción asociada → `ACCION_RECOMENDADA_ID` vacío (no "N/A", no texto).
4. Formato de salida: propongo **CSV + JSON en Drive** por defecto, no API. Es lo de menor
   superficie operativa y coincide con la línea del proyecto (`PLAN-APPSSCRIPT.md` §6);
   si el HRMS exige otra cosa, sale del contrato de integración que todavía no existe.
5. Botón de exportación en `Interfaz.html`.

---

## 4. Huecos bloqueantes — preguntas para el PO

Las primeras cinco son las mismas que el PO ya listó como P0 en su documento; van con la
precisión que hace falta para poder codificarlas. Las últimas cuatro son huecos que
aparecieron al cruzar el refinamiento con el código.

**Bloqueantes (sin esto, `Reglas.gs` queda vacío):**

1. **Matriz normativa completa** de interpretación por dimensión de los 5 instrumentos.
   Hoy solo existen los 25 textos NEO (5 dimensiones × 5 niveles). Faltan CELID-A (9
   escalas), POTENLID (3), CAMIN-A (4) y CONLID-A (3): **19 dimensiones × N niveles**.
2. **Definición matemática de "brecha".** ¿Distancia contra el perfil ideal ya hardcodeado
   en `Correccion.gs:177` (`RADAR_PERFIL_IDEAL`)? ¿Percentil absoluto bajo un corte?
   ¿Otra cosa? El perfil ideal existe en el código y nadie lo declaró como norma.
3. **Umbrales oficiales** de Fortaleza Consolidada, Zona de Crecimiento, Área de
   Desarrollo, Brecha Alta/Media/Baja y Riesgo, expresados en percentil o en T.
   Sub-pregunta concreta: HU1 dice `Percentil > 75`; el código usa `>= 75`
   (`Correccion.gs:81`). ¿P75 exacto es o no es Fortaleza Consolidada?
4. **Reglas de cruce diagnóstico** además del ejemplo. Y la aclaración del ejemplo:
   ¿"Liderazgo Considerado" es *Consideración Individualizada* de CELID-A o *Liderazgo
   Considerado (Apoyo)* de CAMIN-A? Son escalas distintas de instrumentos distintos.
5. **Contrato HRMS**: campos obligatorios, enumeraciones válidas, catálogo de acciones
   recomendadas con ID, formato de entrega (archivo vs. endpoint) y periodicidad.

**Huecos nuevos, detectados contra el código:**

6. **Puntajes NEO fuera del baremo.** HU1 pide rechazar el procesamiento. Hoy se informan
   como "Promedio" (T=50). Confirmar el rechazo: implica que un puntaje máximo en Apertura
   (PD 45–48) deje de producir informe hasta que se extienda el baremo. ¿Se extiende el
   baremo o se rechaza?
7. **Diccionario de Alles: qué papel cumple exactamente.** ¿Es el catálogo oficial de
   competencias para HU4? ¿Qué familias aplican (cardinales + niveles ejecutivos, o
   también intermedios)? ¿Los grados A/B/C/D son la escala de `NIVEL_BRECHA`, o
   `NIVEL_BRECHA` es otra escala y los grados son el nivel *alcanzado*?
8. **Versionado de reglas** (P1 del PO). Confirmo que conviene: sin él, dos informes de la
   misma persona con seis meses de diferencia no son comparables y no se sabe por qué.
   Propuesta: `versionReglas` en cada hallazgo y en el registro de trazabilidad.
   Costo bajo si se hace ahora, alto si se agrega después.
9. **Visibilidad del dato de origen** (P2 del PO). ¿El informe que recibe el líder muestra
   el valor numérico que originó cada interpretación, o eso queda solo en la trazabilidad
   interna? Cambia el render, no el motor.

---

## 5. Lo que se puede hacer sin esperar respuestas

No hace falta bloquearse. Con el catálogo vacío se puede construir y verificar:

- `Motor.gs` completo, con "Pendiente de definir" como salida por defecto — que es
  justamente lo que HU1 pide como caso alternativo.
- `Consistencia.gs` y el bloqueo de publicación.
- La trazabilidad y el versionado.
- La reescritura de `Documento.gs` para que renderice hallazgos en vez de prosa fija.
- El esqueleto de `Hrms.gs` y la extracción del enum de competencias del PDF.

El informe resultante tendría muchos "Pendiente de definir" — pero sería **honesto**, que
es más de lo que se puede decir del actual. Hoy el informe afirma con aplomo cosas que no
verificó; eso, en un informe psicométrico que va a un legajo, es peor que un hueco visible.

---

## 6. Sobre el DoR

El PO marca "Lista para estimar: **No**" en las 4 historias, y "Performance definida:
**No cumple**". Coincido con no forzar la estimación: HU1 y HU4 son 80% contenido
psicométrico y 20% código, y ese 80% no está escrito. Lo que sí se puede estimar y
arrancar es el mecanismo (sección 5).

Sobre performance no hay riesgo real: una corrida tarda ~1,1 s y el límite de Apps Script
es de 6 minutos (`PLAN-APPSSCRIPT.md` §2). Evaluar un catálogo de reglas sobre 24
dimensiones no mueve la aguja. Se puede cerrar ese ítem del DoR con un número:
**< 10 s por informe**, con margen de sobra.
