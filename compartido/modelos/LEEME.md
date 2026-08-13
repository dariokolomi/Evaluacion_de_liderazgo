# Qué archivo es cuál

**Los números de estos nombres no son el modelo de informe: son la revisión.** Los
tres `MODELO DE INFORME…` son variantes del **Informe 1**, la que le pasó el PO al
proyecto en distintos momentos. El del **Informe 2** es el único que dice
"Informe 2" adelante.

| Archivo | Qué es |
|---|---|
| `MODELO - Informe 2 (Integración Organizacional).docx` | El modelo del **Informe 2**: diagnóstico global, matriz de coincidencia con el puesto, inferencias trianguladas, plan de desarrollo y los datos como anexo |
| `MODELO DE INFORME.docx` | Modelo del **Informe 1** |
| `MODELO_DE_INFORME_1.docx` | Modelo del **Informe 1**, con el listado de competencias |
| `MODELO DE INFORME 2.docx` | Modelo del **Informe 1**, segunda revisión — el "2" engaña |
| `PERFIL DE PUESTO - ejemplo.pdf` | Un perfil de puesto de ejemplo, sin la marca del cliente, para probar el contraste |

## Son referencia, no plantillas

**El código no lee ninguno de estos archivos.** Los dos informes se construyen
enteros por código (`Documento.gs` y `Documento2.gs`), igual que hacía el motor
Python, que abría el `.docx` modelo y le borraba todos los párrafos y las tablas
antes de escribir.

Están versionados para poder contrastar contra qué se construyó cada sección. Si
el PO trae una revisión nueva, cambiarla acá no cambia el informe: hay que tocar
el código.

## Lo que no está acá

Los informes **llenos** —los que salen de una corrida real— no se versionan: son
datos psicométricos de personas identificadas. Viven en la carpeta de Drive.
