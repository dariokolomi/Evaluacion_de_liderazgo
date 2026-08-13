/**
 * Control de acceso.
 *
 * Los informes son datos psicométricos de empleados. El acceso se resuelve con
 * Workspace —pertenencia a un Grupo de Google— y no con lógica propia: no hay
 * usuarios, contraseñas ni roles que mantener acá.
 *
 * La verificación se hace en la operación, no sólo en doGet. Un doGet que
 * chequea y una función que no, es una función que queda expuesta el día que
 * alguien la invoque desde otro lado.
 *
 * POR QUÉ ESTO NO ES OPCIONAL: el manifiesto declara `executeAs:
 * "USER_DEPLOYING"`, así que la app entra a Drive y al Sheet con las
 * credenciales de quien la desplegó, no con las de quien la usa. Los permisos de
 * Drive dejan de filtrar: el grupo es la única barrera. Una función que se olvide
 * de llamar a `exigirAcceso` le da a cualquiera del dominio el acceso del
 * dueño del despliegue.
 *
 * Si algún día se vuelve a `USER_ACCESSING`, cada usuario entra con lo suyo y
 * Drive vuelve a ser una segunda barrera — pero hay que darle permiso sobre las
 * carpetas y el Sheet a cada uno, o la app falla al guardar.
 */

/** @return {string} correo del usuario que está ejecutando. */
function usuarioActual() {
  return Session.getActiveUser().getEmail();
}

/**
 * @param {string} grupoAutorizado dirección del Grupo de Google
 * @return {boolean} si el usuario actual pertenece al grupo
 */
function usuarioAutorizado(grupoAutorizado) {
  var correo = usuarioActual();
  if (!correo) return false;
  try {
    return GroupsApp.getGroupByEmail(grupoAutorizado).hasUser(correo);
  } catch (e) {
    // Si el grupo no existe o el script no puede consultarlo, se niega el
    // acceso. Un error de configuración no puede abrir la puerta.
    return false;
  }
}

/** @throws {Error} si el usuario actual no puede usar la app. */
function exigirAcceso(grupoAutorizado) {
  if (!usuarioAutorizado(grupoAutorizado)) {
    throw new Error(
      'No tenés acceso a esta aplicación. Pedí que te agreguen al grupo ' + grupoAutorizado + '.'
    );
  }
}
