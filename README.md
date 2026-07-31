# Generador de Informes de Liderazgo — CCHH

Sistema de perfilamiento de liderazgo: toma las respuestas de una persona evaluada a
cinco cuestionarios estandarizados, las corrige con claves y baremos validados, y produce
un informe en Word con resultados cuantitativos, análisis cualitativo, un mapa de
competencias comparado contra un perfil ideal y —si se carga el documento del puesto— un
contraste entre la persona y lo que el rol exige.

**En producción sobre Google Workspace, versión v2.19.** Corre en Apps Script + Drive +
Sheets: sin servidor, sin proyecto de GCP y sin facturación aparte de la licencia de
Workspace ya contratada.

## Instrumentos

| Instrumento | Mide | Ítems |
|---|---|---|
| **NEO-FFI** | Personalidad — 5 factores (N, E, O, A, C) | 60 |
| **CELID-A** | Estilos de liderazgo (transformacional / transaccional / laissez-faire) | 34 |
| **POTENLID** | Motivación para liderar (intrínseca / extrínseca / social normativa) | 9 |
| **CAMIN-A** | Liderazgo camino-meta (directivo / considerado / participativo / metas) | 12 |
| **CONLID-A** | Conductas de liderazgo (tarea / relaciones / cambio) | 18 |

Las claves y baremos están validados y hardcodeados en el motor. **No se modifican ni se
reinterpretan.**

## Cómo se usa

1. Se entra a la URL de la aplicación con la cuenta corporativa.
2. Se sube la planilla de respuestas (`.xlsx`) y se escribe el nombre de la persona.
3. Opcionalmente se sube el **perfil de puesto** (`.pdf`, `.docx` o `.doc`). Con él, el
   informe suma el punto 6; sin él sale con las cinco secciones de siempre.
4. Se genera. Una corrida tarda entre 3 y 5 minutos, casi todo esperando al modelo de
   lenguaje que redacta las secciones narrativas.
5. El informe queda en Drive y la corrida en el historial, donde después se califica de
   1 a 5 con un comentario. De ahí sale el tablero de métricas.

Cada evaluación recibe un **código correlativo** (`A01`, `A02`… `B01`) que prefija sus
tres archivos, así quedan juntos al ordenar la carpeta por nombre:

```
A12-INFORME vicky L. 20260731-1247.docx
A12-PLANILLA vicky L..xlsx
A12-PERFIL Scrum Master … .pdf
```

## Qué calcula el código y qué escribe el modelo

Es la decisión que ordena todo el sistema. **Los números nunca dependen del modelo de
lenguaje.** El índice de adecuación, los percentiles, los niveles y las alertas los
calcula el código con cortes fijos. Al modelo se le pide sólo la prosa, y en el punto 6
además la lectura del documento del puesto —de la que debe citar textualmente, porque
cada cita se verifica contra el archivo y la que no aparece no entra al cálculo.

Si el modelo no contesta, falla o no está configurado, el informe **se genera igual** con
el texto armado por reglas. La interfaz avisa cuándo pasó eso y por qué.

El nombre de la persona evaluada **no viaja al modelo**: se manda un marcador y el nombre
se sustituye después, del lado del servidor.

## Estructura del repositorio

```
02-appsscript/        La aplicación en producción
├── *.gs                    Motor, orquestador, web app, síntesis y punto 6
├── Interfaz.html           La UI que sirve HtmlService
├── appsscript.json         Manifiesto: permisos y modo de ejecución
├── INSTALACION-DESDE-CERO.docx   Montar todo en un Workspace vacío
├── PUESTA-EN-MARCHA.docx   La guía de la primera migración (histórica)
├── PLAN-APPSSCRIPT.md      Plan del port y decisiones de arquitectura
├── tests/                  11 verificadores en Node, contra el motor Python y
│                           contra servicios de Google simulados
└── herramientas/           Lo que genera los documentos en Word y el PDF de ejemplo

01-legacy-python/     App Flask original, superada por la de Workspace
├── run_engine.py           El motor contra el que se verifica el port
├── app.py                  Servidor web y API
└── salidas/                Informes y gráficos de las corridas de abril 2026

compartido/           Datos que alimentan a ambos proyectos
├── instrumentos/     Claves, baremos y planillas de respuestas
├── modelos/          Plantillas .docx del informe y el perfil de puesto de ejemplo
└── referencias/      Material teórico e interpretativo
```

## Documentación

| Documento | Para qué |
|---|---|
| [`ACCESOS.md`](ACCESOS.md) | Dar de alta y de baja a una persona en la aplicación |
| [`02-appsscript/INSTALACION-DESDE-CERO.docx`](02-appsscript/INSTALACION-DESDE-CERO.docx) | Montar la app en un Workspace vacío, en ocho pasos |
| [`02-appsscript/PLAN-APPSSCRIPT.md`](02-appsscript/PLAN-APPSSCRIPT.md) | Por qué la arquitectura es ésta y qué se descartó |

## Verificación

Once verificadores corren en Node sin tocar Google. El más importante compara la
corrección contra el motor Python original: **507 planillas, ~48.165 valores**, entre las
reales, casos de borde y 500 sintéticas.

```bash
cd 02-appsscript/tests
python3 dump-referencia.py && python3 dump-celdas.py && python3 dump-docx.py
for t in port lectura documento orquestador webapp metricas radar interfaz perfil puesto sintesis; do
  node verificar-$t.js
done
```

> Los tres `.json` que generan los `dump-*.py` son locales y están en `.gitignore` porque
> contienen respuestas de personas reales. Si están desactualizados, los verificadores
> pasan por la razón equivocada: regeneralos antes de creerles.

## La app original en Python

Queda como antecedente y como referencia de verificación: `verificar-port.js` compara la
corrección de Apps Script contra este motor, así que el proyecto no es sólo historia.

```bash
cd 01-legacy-python
pip install flask openpyxl python-docx matplotlib numpy
python3 app.py          # abre http://localhost:5000
```

Es **monousuario y local**: no tiene autenticación y usa el filesystem como base de datos.
Todo eso es lo que resolvió la migración a Workspace.

> Los informes contienen **datos psicométricos de empleados**. Tratar el contenido de la
> Unidad compartida, de `01-legacy-python/salidas/` y de `compartido/instrumentos/` como
> información personal sensible.
