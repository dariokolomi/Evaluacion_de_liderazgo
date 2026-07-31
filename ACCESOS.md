# Manual: dar acceso a la aplicación

Cómo se da de alta y de baja a una persona en el Generador de Informes de Liderazgo.
Para qué es la aplicación y cómo se usa, ver el [README](README.md).

## Lo que hay que entender antes de tocar nada

El manifiesto (`02-appsscript/appsscript.json`) declara dos cosas que definen todo el
modelo de acceso:

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

Esto no es un descuido: está documentado en `Acceso.gs`, y por eso cada función que llama
el navegador vuelve a verificar la pertenencia al grupo por su cuenta.

## Paso a paso

### 1. Confirmar que corresponde

Preguntá si la persona debe poder ver **los informes psicométricos de todo el personal
evaluado**. Si la respuesta es "sólo los de su área" o "sólo los que ella genere", **la
aplicación no puede hacer eso** y hay que resolverlo fuera del sistema.

### 2. Agregarla al Grupo de Google

Entrá a [admin.google.com](https://admin.google.com) o
[groups.google.com](https://groups.google.com), abrí el grupo autorizado y agregala como
**miembro**.

Para saber cuál es el grupo, si no lo tenés a mano: en el editor de Apps Script,
**Configuración del proyecto → Propiedades del script**, propiedad `GRUPO_AUTORIZADO`.

> El rol dentro del grupo (miembro, gestor, propietario) es indistinto para la app: sólo
> se consulta la pertenencia.

### 3. Esperar la propagación

El alta no siempre es instantánea. Si la persona entra enseguida y ve "Sin acceso",
esperá unos minutos y que vuelva a probar antes de buscar el problema en otro lado.

### 4. Verificar antes de avisarle

Desde el editor de Apps Script, ejecutá la función **`verificarConfiguracion`**. En el
registro tiene que aparecer:

```
¿Autorizado?: true
```

Esa función responde por **la cuenta que la ejecuta**, así que confirma la configuración
general. Para verificar a la persona nueva en concreto, lo más rápido es que abra la URL
y te diga qué ve.

### 5. Pasarle la URL

Es la de la implementación activa. Si no la tenés:

```bash
cd 02-appsscript && clasp deployments
```

La que corresponde es la que está fijada a una versión con descripción
(`@36 - v2.19 …`), no la que dice `@HEAD` — esa sirve el código sin publicar y es para
pruebas.

### 6. Contarle lo mínimo

- La planilla se **sube desde la app**; no hace falta que toque Drive.
- El perfil de puesto es **opcional** y agrega el punto 6.
- Una corrida tarda **entre 3 y 5 minutos**. No es que se colgó.
- Después de generar, conviene **calificar el informe** de 1 a 5: de ahí sale el tablero
  de métricas.

## Quitarle el acceso a alguien

Sacala del Grupo de Google. No hay nada más que hacer: no tiene permisos propios sobre
Drive que revocar, porque nunca los tuvo.

Los informes que haya generado **quedan**, y su dirección de correo sigue figurando en la
columna "Generado por" del historial. Eso es deliberado: es la trazabilidad de quién
generó qué.

## Problemas frecuentes

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| "Sin acceso. Esta aplicación es del equipo de RRHH…" | No está en el grupo, o el alta no propagó todavía | Verificar la membresía; esperar unos minutos |
| No abre la URL / pide elegir cuenta | Está con una cuenta personal | Que entre con la cuenta corporativa |
| "Falta configurar el proyecto…" | Falta una propiedad del script | Ver el mensaje: nombra cuál falta y para qué es |
| Entra pero falla al guardar | La cuenta del **desplegador** perdió acceso a la Unidad compartida | Revisar los permisos del desplegador, no los del usuario |

## Una advertencia sobre el desplegador

Como la app corre como quien la desplegó, **todo depende de esa cuenta**. Si se desactiva
—una baja, un cambio de área— la aplicación deja de funcionar para todos, sin importar
quién esté en el grupo.

Conviene que el despliegue esté hecho desde una **cuenta de servicio o de área**, no desde
la personal de alguien que puede irse. Si hoy está en una cuenta personal, vale la pena
moverlo antes de que sea urgente.
