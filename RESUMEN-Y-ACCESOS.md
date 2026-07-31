# Generador de Informes de Liderazgo — CCHH

Aplicación de Google Workspace que toma las respuestas de una persona evaluada a cinco
cuestionarios psicométricos y produce un informe en Word: resultados cuantitativos,
análisis cualitativo, mapa de competencias contra un perfil ideal y —si se carga el
documento del puesto— un contraste entre la persona y lo que el rol exige.

**En producción, versión v2.19.** Corre sobre Apps Script + Drive + Sheets: sin
servidor, sin proyecto de GCP y sin facturación aparte de la licencia de Workspace.

## Qué mide

| Instrumento | Mide | Ítems |
|---|---|---|
| **NEO-FFI** | Personalidad — 5 factores (N, E, O, A, C) | 60 |
| **CELID-A** | Estilos de liderazgo (transformacional / transaccional / laissez-faire) | 34 |
| **POTENLID** | Motivación para liderar (intrínseca / extrínseca / social normativa) | 9 |
| **CAMIN-A** | Liderazgo camino-meta (directivo / considerado / participativo / metas) | 12 |
| **CONLID-A** | Conductas de liderazgo (tarea / relaciones / cambio) | 18 |

Las claves y baremos están validados y hardcodeados en el motor. **No se modifican ni
se reinterpretan.**

## Cómo se usa

1. Se entra a la URL de la aplicación con la cuenta corporativa.
2. Se sube la planilla de respuestas (`.xlsx`) y se escribe el nombre de la persona.
3. Opcionalmente se sube el **perfil de puesto** (`.pdf`, `.docx` o `.doc`). Con él,
   el informe suma el punto 6; sin él sale con las cinco secciones de siempre.
4. Se genera. Una corrida tarda entre 3 y 5 minutos, casi todo esperando al modelo de
   lenguaje que redacta las secciones narrativas.
5. El informe queda en Drive y la corrida en el historial, donde después se califica
   de 1 a 5 con un comentario.

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

Si el modelo no contesta, falla o no está configurado, el informe **se genera igual**
con el texto armado por reglas. La interfaz avisa cuándo pasó eso y por qué.

El nombre de la persona evaluada **no viaja al modelo**: se manda un marcador y el
nombre se sustituye después, del lado del servidor.

## Estructura del repositorio

```
01-legacy-python/     App Flask original, superada por la de Workspace
02-appsscript/        La aplicación en producción
├── *.gs              Motor, orquestador, web app, síntesis y punto 6
├── Interfaz.html     La UI que sirve HtmlService
├── appsscript.json   Manifiesto: permisos y modo de ejecución
├── tests/            11 verificadores en Node
└── herramientas/     Lo que genera las guías en Word
compartido/           Claves, baremos, plantillas y material de referencia
```

## Verificación

Once verificadores corren en Node sin tocar Google. El más importante compara la
corrección contra el motor Python original: **507 planillas, ~48.165 valores**, entre
las reales, casos de borde y 500 sintéticas.

```bash
cd 02-appsscript/tests
python3 dump-referencia.py && python3 dump-celdas.py && python3 dump-docx.py
for t in port lectura documento orquestador webapp metricas radar interfaz perfil puesto sintesis; do
  node verificar-$t.js
done
```

> Los tres `.json` son locales y están en `.gitignore` porque contienen respuestas de
> personas reales. Si están desactualizados, los verificadores pasan por la razón
> equivocada: regeneralos antes de creerles.

## Datos sensibles

Los informes contienen **datos psicométricos de empleados**. Tratar el contenido de la
Unidad compartida y de `compartido/instrumentos/` como información personal sensible.
Los perfiles de puesto reales están ignorados por patrón; el ejemplo versionado
(`compartido/modelos/PERFIL DE PUESTO - ejemplo.pdf`) es una reconstrucción sin marca
ni datos reales.

---

# Manual: dar acceso a una persona nueva

## Lo que hay que entender antes de tocar nada

El manifiesto (`appsscript.json`) declara dos cosas que definen todo el modelo de
acceso:

```json
"webapp": { "access": "DOMAIN", "executeAs": "USER_DEPLOYING" }
```

- **`access: DOMAIN`** — la URL sólo abre para cuentas del dominio corporativo.
- **`executeAs: USER_DEPLOYING`** — la app entra a Drive y al Sheet con las credenciales
  de **quien la desplegó**, no con las de quien la usa.

La consecuencia práctica, y es la que importa:

> **Los permisos de Drive no filtran nada. El Grupo de Google es la única barrera.**

Quien entra no necesita permiso sobre la Unidad compartida, las carpetas ni el Sheet:
todo lo escribe la cuenta del desplegador. Por eso **agregar a alguien al grupo le da
acceso completo a los informes de todas las personas evaluadas**, no sólo a los suyos.
Dentro del grupo, todos ven todo. No hay roles ni jerarquía dentro de la app.

Esto no es un descuido: está documentado en `Acceso.gs`, y por eso cada función que
llama el navegador vuelve a verificar la pertenencia al grupo por su cuenta.

## Paso a paso

### 1. Confirmar que corresponde

Preguntá si la persona debe poder ver **los informes psicométricos de todo el
personal evaluado**. Si la respuesta es "sólo los de su área" o "sólo los que ella
genere", **la aplicación no puede hacer eso** y hay que resolverlo fuera del sistema.

### 2. Agregarla al Grupo de Google

Entrá a [admin.google.com](https://admin.google.com) o
[groups.google.com](https://groups.google.com), abrí el grupo autorizado y agregala
como **miembro**.

Para saber cuál es el grupo, si no lo tenés a mano: en el editor de Apps Script,
**Configuración del proyecto → Propiedades del script**, propiedad `GRUPO_AUTORIZADO`.

> El rol dentro del grupo (miembro, gestor, propietario) es indistinto para la app:
> sólo se consulta la pertenencia.

### 3. Esperar la propagación

El alta no siempre es instantánea. Si la persona entra enseguida y ve "Sin acceso",
esperá unos minutos y que vuelva a probar antes de buscar el problema en otro lado.

### 4. Verificar antes de avisarle

Desde el editor de Apps Script, ejecutá la función **`verificarConfiguracion`**. En el
registro tiene que aparecer:

```
¿Autorizado?: true
```

Esa función responde por **la cuenta que la ejecuta**, así que confirma la
configuración general. Para verificar a la persona nueva en concreto, lo más rápido es
que abra la URL y te diga qué ve.

### 5. Pasarle la URL

Es la de la implementación activa. Si no la tenés:

```bash
cd 02-appsscript && clasp deployments
```

La que corresponde es la que está fijada a una versión con descripción (`@36 - v2.19 …`),
no la que dice `@HEAD` — esa sirve el código sin publicar y es para pruebas.

### 6. Contarle lo mínimo

- La planilla se **sube desde la app**; no hace falta que toque Drive.
- El perfil de puesto es **opcional** y agrega el punto 6.
- Una corrida tarda **entre 3 y 5 minutos**. No es que se colgó.
- Después de generar, conviene **calificar el informe** de 1 a 5: de ahí sale el
  tablero de métricas.

## Quitarle el acceso a alguien

Sacala del Grupo de Google. No hay nada más que hacer: no tiene permisos propios sobre
Drive que revocar, porque nunca los tuvo.

Los informes que haya generado **quedan**, y su dirección de correo sigue figurando en
la columna "Generado por" del historial. Eso es deliberado: es la trazabilidad de quién
generó qué.

## Problemas frecuentes

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| "Sin acceso. Esta aplicación es del equipo de RRHH…" | No está en el grupo, o el alta no propagó todavía | Verificar la membresía; esperar unos minutos |
| No abre la URL / pide elegir cuenta | Está con una cuenta personal | Que entre con la cuenta corporativa |
| "Falta configurar el proyecto…" | Falta una propiedad del script | Ver el mensaje: nombra cuál falta y para qué es |
| Entra pero falla al guardar | La cuenta del **desplegador** perdió acceso a la Unidad compartida | Revisar los permisos del desplegador, no los del usuario |

## Una advertencia sobre el desplegador

Como la app corre como quien la desplegó, **todo depende de esa cuenta**. Si se
desactiva —una baja, un cambio de área— la aplicación deja de funcionar para todos, sin
importar quién esté en el grupo.

Conviene que el despliegue esté hecho desde una **cuenta de servicio o de área**, no
desde la personal de alguien que puede irse. Si hoy está en una cuenta personal, vale la
pena moverlo antes de que sea urgente.
