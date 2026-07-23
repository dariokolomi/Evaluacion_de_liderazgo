# Generador de Informes de Liderazgo — CCHH

Sistema de perfilamiento de liderazgo: toma las respuestas de una persona evaluada a
cinco cuestionarios estandarizados, las corrige con claves y baremos validados, y produce
un informe en Word con resultados cuantitativos, análisis cualitativo y un mapa de
competencias comparado contra un perfil ideal.

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

## Estructura del repositorio

```
01-legacy-python/     App Flask actual, en funcionamiento
├── app.py            Servidor web y API
├── run_engine.py     Motor: corrección + gráfico radar + armado del .docx
├── templates/        UI que sirve Flask
├── documentacion.html      Página de presentación del sistema (autocontenida, no la sirve Flask)
├── salidas/          Informes generados y gráficos
├── scripts-previos/  Flujo original de scripts sueltos (superado por run_engine)
│   └── SESION_CONTINUIDAD.md   Registro de la corrida manual de abril 2026
└── distribucion-windows/   Copia autocontenida con .bat para PC sin entorno

02-appsscript/        Migración a Google Workspace — código portado, sin subir todavía
├── PLAN-APPSSCRIPT.md      Plan aprobado y estado del port — leer antes de retomar
├── PUESTA-EN-MARCHA.docx   Guía para subir el proyecto a Workspace
├── *.gs                    El proyecto: motor, orquestador, web app y métricas
├── Interfaz.html           La UI que sirve HtmlService
├── appsscript.json         Manifiesto: scopes y servicios avanzados
├── tests/                  Verificación en Node contra el motor Python y contra
│                           servicios de Google simulados
└── herramientas/           Lo que genera la guía en Word

compartido/           Datos que alimentan a ambos proyectos
├── instrumentos/     Claves, baremos y planillas de respuestas
├── modelos/          Plantillas .docx del informe
└── referencias/      Material teórico e interpretativo
```

## Uso (versión actual)

```bash
cd 01-legacy-python
pip install flask openpyxl python-docx matplotlib numpy
python3 app.py          # abre http://localhost:5000
```

Desde la web: elegís la planilla de respuestas y el modelo de informe, ponés el nombre
de la persona evaluada y se genera el `.docx` en `salidas/`. Una corrida tarda ~1 segundo.
El historial y las calificaciones quedan en `.runs_history.json`.

## Estado y rumbo

La versión actual es **monousuario y local**: no tiene autenticación y usa el filesystem
como base de datos. Su migración a **Google Apps Script + Drive + Sheets** está aprobada y
el código ya está portado entero: corrección, lectura, armado del informe, radar,
orquestador, interfaz web y métricas.

Falta subirlo a un proyecto de Apps Script y probarlo con una planilla real. Todo está
verificado en Node —contra el motor Python y contra servicios de Google simulados— pero
eso no prueba que la API real se comporte igual.

El plan y el estado del port están en
[`02-appsscript/PLAN-APPSSCRIPT.md`](02-appsscript/PLAN-APPSSCRIPT.md); los pasos para
subirlo, en [`02-appsscript/PUESTA-EN-MARCHA.docx`](02-appsscript/PUESTA-EN-MARCHA.docx).

> Los informes contienen **datos psicométricos de empleados**. Tratar el contenido de
> `salidas/` y `compartido/instrumentos/` como información personal sensible.
