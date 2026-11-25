# Guía funcional

Qué guarda Madre en cada área, de dónde sale cada dato y qué reglas aplica, explicado desde la operación de la tienda.

← [Volver al inicio](../README.md)

**Contenido**

1. [El catálogo madre](#el-catálogo-madre)
2. [De dónde salen los datos del catálogo](#de-dónde-salen-los-datos-del-catálogo)
3. [Publicaciones en marketplaces](#publicaciones-en-marketplaces)
4. [SKUs pausados a mano](#skus-pausados-a-mano)
5. [El publicador](#el-publicador)
6. [Marcas y categorías de cada marketplace](#marcas-y-categorías-de-cada-marketplace)
7. [Pedidos](#pedidos)
8. [Facturación](#facturación)
9. [MercadoLibre](#mercadolibre)
10. [Analítica](#analítica)
11. [Carpetas de favoritos y segmentos](#carpetas-de-favoritos-y-segmentos)
12. [Ventas y aporte de MercadoLibre](#ventas-y-aporte-de-mercadolibre)
13. [Central de Promociones](#central-de-promociones)
14. [Impuestos por categoría](#impuestos-por-categoría)
15. [Planilla de control](#planilla-de-control)
16. [Cambios del catálogo](#cambios-del-catálogo)
17. [Usuarios del panel](#usuarios-del-panel)
18. [Productos para Google Shopping](#productos-para-google-shopping)

---

## El catálogo madre

Es la lista maestra de productos de la tienda. Tiene **un registro por SKU**, y el SKU es casi siempre el ASIN del producto en Amazon (`B0953HLGJ3`).

| Dato | Qué es |
|---|---|
| Título y descripción | Los de la publicación en MercadoLibre, con la descripción limpia. |
| Categoría | La ruta completa de la categoría de MercadoLibre (`Ropa y Accesorios > Equipaje > Mochilas`) y su código (`MLA1055`). |
| Precio | El precio de venta en MercadoLibre. |
| Precio Amazon | El costo total del producto en Amazon. |
| Peso | El peso máximo que informa Automeli. Se usa para calcular el flete. |
| Stock | El stock disponible. |
| Estado | `active` o `inactive`. Ver [Procesos y estados](procesos.md#estado-de-un-producto). |
| Imágenes | Hasta 10, en orden, más un video. |
| Atributos | Marca, color, modelo, material y talle. |
| Tiempo de envío | Los días de fabricación o preparación que informa Automeli. |
| Estado en MercadoLibre y en Amazon | Tal como los informa Automeli. |

Este servicio solo **lee** el catálogo para los demás: no se cargan productos a mano por la API. Los datos entran por las dos sincronizaciones automáticas.

---

## De dónde salen los datos del catálogo

Cada dato del catálogo tiene un dueño. Dos procesos automáticos lo alimentan cuatro veces por día, a las 00, 06, 12 y 18 h:

| Proceso | Fuente | Qué escribe | Crea productos |
|---|---|---|---|
| **Sync Automeli** | Automeli, la herramienta que publica los productos de Amazon en MercadoLibre | Precio, precio Amazon, peso, stock, estado, tiempo de envío, estados en MercadoLibre y Amazon | No: solo actualiza SKUs que ya existen |
| **Import MercadoLibre** | Las publicaciones de MercadoLibre guardadas en Madre | Título, descripción, categoría, imágenes, marca, precio y stock | Sí |

Reglas que conviene tener presentes:

- **Automeli solo toca las publicaciones Clásicas** (`gold_special`). Las demás quedan guardadas como foto de Automeli, pero no modifican el catálogo.
- **Solo se escribe lo que cambió.** Cada proceso recuerda la última versión de cada SKU y saltea los que siguen iguales.
- **Si un SKU tiene varias publicaciones en MercadoLibre**, el import toma la de **menor precio**.

El detalle, y lo que pasa cuando los dos procesos se cruzan, está en [Procesos y estados](procesos.md).

---

## Publicaciones en marketplaces

Madre guarda una foto del estado de cada SKU en los marketplaces externos: **Megatone, Frávega y OnCity**. Los procesos de sincronización de cada marketplace la cargan.

Por cada publicación se guarda:

- El SKU propio y el ID de la publicación en el marketplace.
- Precio, stock y estado.
- La última vez que se la vio en el marketplace.

**Historial.** Cada vez que cambia el precio, el stock o el estado se guarda una fila de historial con los valores nuevos. Un cambio en cualquier otro dato no deja historial.

**Corridas de sincronización.** Cada corrida que lee un marketplace queda registrada, con cuántos lotes y publicaciones procesó, cuántas fallaron y cómo terminó.

Los estados posibles están en [Procesos y estados](procesos.md#estado-de-una-publicación-en-un-marketplace).

---

## SKUs pausados a mano

Es una lista de SKUs marcados como **pausados**, para que no se publiquen o queden pausados en los marketplaces. Madre solo guarda la marca: quien publica o sincroniza es el que la respeta.

- Un SKU que **no está en la lista** se considera **no pausado**.
- Los SKUs se guardan en mayúsculas y sin espacios.
- Marcar uno que ya está en la lista lo actualiza; no lo duplica.

---

## El publicador

Sirve para publicar muchos SKUs en uno o varios marketplaces a la vez.

| Concepto | Qué es |
|---|---|
| **Corrida** | Una publicación masiva: "publicar estos SKUs en Megatone y Frávega". |
| **Tarea** | Un SKU para publicar en un marketplace. Una corrida de 100 SKUs en 2 marketplaces tiene 200 tareas. |

El recorrido:

1. Se crea la corrida con la lista de marketplaces.
2. Se le cargan las tareas, una por SKU y marketplace.
3. Los procesos que publican **toman tareas** de a lotes de hasta 50. Dos procesos nunca toman la misma tarea.
4. Cada proceso informa el resultado de cada tarea: publicada, fallida, a reintentar u omitida, con el ID de la publicación o el error.
5. Desde el panel se ve el avance, se **reintentan las fallidas** o se **cancela** la corrida.

Madre no publica nada por su cuenta: solo lleva la cuenta de qué falta, qué salió y qué falló.

**Cancelar** una corrida frena las tareas que todavía no se tomaron. Las que ya estaban en proceso siguen hasta terminar.

**Reintentar** vuelve a poner en espera solo las tareas **fallidas**. No hay un tope de reintentos.

Los estados y sus transiciones están en [Procesos y estados](procesos.md#el-publicador).

---

## Marcas y categorías de cada marketplace

Cada marketplace tiene su propio listado de marcas y su propio árbol de categorías. Para publicar un producto hay que traducir la marca y la categoría de MercadoLibre a las del marketplace.

### Marcas

Hay dos tablas de equivalencias distintas:

| Equivalencia | De qué a qué | Marketplaces |
|---|---|---|
| **Marca por SKU** | Un SKU → la marca que ese marketplace le asigna | OnCity, Megatone, Frávega |
| **Marca de MercadoLibre** | Un nombre de marca de MercadoLibre → la marca del marketplace, con un grado de confianza de 0 a 1 | Frávega, Megatone |

El grado de confianza sale del proceso de equivalencia automática. La analítica considera que una marca "tiene equivalencia" en un marketplace cuando la confianza es **mayor a 0,8**.

También se puede consultar el listado de marcas que aparecen en el catálogo madre.

### Categorías

| Marketplace | Qué guarda Madre |
|---|---|
| **Frávega** | Su árbol de categorías, los atributos que pide cada categoría (cuáles son obligatorios y sus opciones) y la equivalencia categoría de MercadoLibre → categoría de Frávega. |
| **Megatone** | Solo la equivalencia categoría de MercadoLibre → categoría de Megatone. |

Al actualizar una equivalencia de categoría, la ruta de MercadoLibre que ya estaba guardada no cambia: solo cambia la categoría del marketplace.

---

## Pedidos

`order-api` toma los pedidos de **Frávega, Megatone, OnCity y MercadoLibre**, los lleva a un formato común y los guarda en Madre.

- **Cada pedido entra una sola vez.** Se identifica con `marketplace:ID del pedido` (por ejemplo `fravega:v90520163frvg-01`). Si llega un pedido que ya existe, se ignora: no se actualiza.
- Se guardan los datos del comprador, el envío, el importe, el estado en el marketplace y el pedido original completo.
- Un pedido nuevo queda **pendiente**. `order-api` toma los pendientes, los envía a Flokzu y a Azure Tasks, y vuelve a Madre a registrar el resultado y el **código TLQV** que devolvió Flokzu (`TLQV-12270`). Ahí nace el código de venta que usa el resto de los sistemas.
- `order-api` también puede registrar un pedido **ya procesado**, con su estado y su código TLQV, sin el paso intermedio.
- Además se guardan los identificadores de la venta en VBI, la fecha estimada de entrega y, cuando los hay, el número, el enlace y la fecha de la factura.
- Desde el panel se pueden listar los pedidos y buscarlos por clave, comprador, documento, email o código TLQV.

Los estados de un pedido están en [Procesos y estados](procesos.md#pedidos).

---

## Facturación

`invoice.api` factura las ventas en Xubio. Madre le guarda dos cosas.

### Copia de los comprobantes de Xubio

Una copia de las facturas, notas de crédito y facturas de crédito electrónicas (FCE) emitidas en Xubio, con sus conceptos, cobranzas y percepciones. `invoice.api` la actualiza cada 2 horas y cuando se le pide una sincronización a mano. Cada comprobante queda asociado a su venta por el **código TLQV** y, si lo tiene, por el número de orden de MercadoLibre.

`invoice.api` usa esta copia para **no facturar dos veces la misma venta**. Madre responde si una venta "tiene factura" con este criterio:

> Hay al menos una **factura** de la venta con **CAE**.

Madre **no descuenta las facturas anuladas por nota de crédito**: una venta con factura y nota de crédito sigue figurando como facturada. Esa regla la aplica `invoice.api`, que pide todos los comprobantes de la venta y cruza cada nota de crédito con la factura que anula.

Cada sincronización queda registrada con su tipo (histórica, diaria o reintento manual), la ventana de fechas, cuántos comprobantes leyó, agregó y actualizó, y cómo terminó.

También se puede consultar qué clientes ya figuran en Xubio: un cliente "existe" si aparece en algún comprobante sincronizado.

### Ventas que no se pudieron facturar

Cuando `invoice.api` no puede facturar una venta, guarda un **issue** en Madre con el motivo, los datos del comprador y la respuesta del sistema que falló. Desde el panel se listan, se agrupan por cliente y se marcan como resueltos o ignorados.

- **Si la misma venta vuelve a fallar por el mismo motivo**, no se crea otro issue: se suma una ocurrencia al existente y se actualizan sus datos.
- **Si ese issue estaba resuelto o ignorado, se reabre.** Si estaba borrado, vuelve a aparecer.

Los motivos los define `invoice.api`; están explicados en su página de bloqueos. Los estados del issue están en [Procesos y estados](procesos.md#ventas-que-no-se-pudieron-facturar).

---

## MercadoLibre

Madre tiene una copia de las publicaciones propias en MercadoLibre, que cargan los procesos de `mercadolibre-api`:

| Dato | Qué es |
|---|---|
| **Publicaciones (IDs)** | La lista de MLA del vendedor con su estado. Las que aparecieron por primera vez hoy se pueden pedir aparte. |
| **Publicaciones (detalle)** | Título, precio, stock, unidades vendidas, estado, categoría, marca, SKU, salud de la publicación, envío gratis, fotos y descripción. |
| **Visitas** | El total acumulado de visitas de cada publicación. No hay historial: cada carga reemplaza el número. |
| **Categorías** | El árbol de categorías de MercadoLibre, con su nivel y su ruta desde la raíz. |
| **Credenciales** | Los tokens de acceso a la API de MercadoLibre, uno vigente por aplicación. El vencimiento lo calcula Madre a partir de la duración informada. |
| **Avance de las sincronizaciones** | Para cada proceso y vendedor, hasta dónde llegó y si está corriendo, terminó o falló, para retomar después de un corte. |

Un mismo SKU puede tener varias publicaciones en MercadoLibre.

Madre también guarda la **foto completa del catálogo de Automeli**: por cada publicación, el ASIN, precios de Amazon, peso, stock, estados en Amazon y MercadoLibre, tipo de publicación y motivo de pausa. Se puede consultar por SKU, con la opción de quedarse con una publicación por SKU (prioriza la Clásica, después la Premium, después la más reciente).

---

## Analítica

Es el tablero para decidir qué productos llevar a otros marketplaces. Se calcula sobre la copia de las publicaciones de MercadoLibre, no sobre las ventas reales. **Los nombres de las métricas engañan**, así que conviene leerlas así:

| Métrica | Qué es en realidad |
|---|---|
| **Órdenes** (`orders`) | Las **unidades vendidas acumuladas** que informa MercadoLibre en cada publicación. No es la cantidad de pedidos. |
| **Facturación** (`revenue`) | **Precio actual × unidades vendidas.** Es una estimación: no usa el precio al que se vendió ni lo facturado. |
| **Visitas** | Visitas acumuladas de la publicación. |
| **Ticket promedio** | Facturación ÷ unidades. |
| **Conversión** | Unidades ÷ visitas × 100. |
| **Publicado** en un marketplace | El SKU tiene una publicación activa en ese marketplace. |

Se puede ver por marca, por categoría (cada rama suma todas sus subcategorías) y por producto, con filtros por precio, visitas, unidades, marca, categoría, estado en MercadoLibre, si ya está publicado en un marketplace y si la marca tiene equivalencia.

**Productos con SKU válido.** La analítica de productos solo cuenta publicaciones cuyo SKU, tomando lo que está antes de una `/`, tiene entre 1 y 13 caracteres.

**Resultados guardados.** Los números por categoría se guardan para no recalcularlos en cada consulta. **No se vencen solos**: se recalculan recién cuando alguien pide invalidarlos.

---

## Carpetas de favoritos y segmentos

Una **carpeta** (en el código, "marketplace") agrupa publicaciones candidatas a publicar en un canal, por ejemplo "megatone".

- Una carpeta está **activa** o **cerrada**. Una carpeta cerrada **no admite cambios**: no se le agregan ni se le sacan productos, y **no se puede borrar**.
- Se pueden agregar productos de a uno, en lote a varias carpetas a la vez, o **todo lo que cumple un filtro** de la analítica.
- Para cada carpeta se ven totales, marcas y categorías, con las mismas métricas de la analítica.
- **Limpiar SKUs duplicados** deja una sola publicación por SKU dentro de la carpeta.

Un **segmento** guarda un filtro de la analítica junto con la lista de productos que lo cumplían en ese momento, para reutilizarlo.

---

## Ventas y aporte de MercadoLibre

Madre lee una tabla de ventas de MercadoLibre con sus datos contables: precio de venta, saldo, comisión, cuotas, costo de envío, impuestos, comprador y el **aporte de MercadoLibre**. Esa tabla la carga otro proceso, con las columnas de la planilla de control.

El aporte de MercadoLibre es la columna `APORTE ML` de la planilla. Madre no lo calcula: lo toma como viene.

Los reportes de aporte:

- Solo cuentan ventas **con aporte distinto de cero**.
- Por defecto arrancan el **1 de mayo de 2026**. Ese corte está fijo en el código.
- Muestran el listado de ventas, los totales y promedios, la evolución por día o por mes, y la apertura por estado de la orden.

---

## Central de Promociones

Madre guarda la lista de publicaciones de MercadoLibre (MLA) que participan de las campañas de la Central de Promociones. Se cargan de a una o en lotes de hasta 1000, en mayúsculas y sin duplicados.

> **Atención:** la consulta "¿estas publicaciones están en la lista?" hoy responde **que sí para todas**, sin mirar la lista. Se cambió así a propósito; la consulta real quedó en el código sin usar.

---

## Impuestos por categoría

Para cada categoría de MercadoLibre (MLA) hay una ficha con la posición arancelaria y la carga de importación:

| Dato | Qué es |
|---|---|
| Posición arancelaria | La categoría arancelaria del producto. |
| DIE | Derecho de importación. |
| TE | Tasa de estadística. |
| IVA | Alícuota de IVA. |
| Configuración Automeli | Cómo se compone la carga en Automeli y su código de categoría. |

Sirve para estimar el costo de importar un producto según su categoría. Estos datos viven en una base de datos aparte.

---

## Planilla de control

Es la planilla de seguimiento de cada venta, con una fila por operación identificada por su TLQV. `spreadsheet.tlq` la vuelca en Madre.

Cada fila reúne:

- **La venta:** número de venta, precio, comisión, saldo, cuotas y aporte de MercadoLibre.
- **La compra en Amazon:** pedido, tracking, precio en dólares y tipo de cambio.
- **El viaje:** llegada y salida de Estados Unidos, ingreso a Argentina, Ezeiza, fecha estimada en Buenos Aires y guías.
- **La facturación:** importes de la factura e impuestos.
- **El cliente:** CUIT, nombre, dirección, ciudad, provincia y código postal.

Se aceptan los nombres de columna normalizados (`nro_venta`) o los encabezados originales de la planilla (`NROVENTA`). Las columnas desconocidas se descartan.

---

## Cambios del catálogo

Madre lleva un registro de cada cambio del catálogo, campo por campo: qué producto, qué campo, valor anterior, valor nuevo y de dónde vino el cambio.

Los servicios que replican el catálogo lo leen en orden y guardan **hasta dónde leyeron** con una marca propia (`products_api_delta`, por ejemplo). Esa marca **solo avanza**: si se informa una posición anterior, se conserva la más alta.

También se puede ver un resumen de la actividad reciente: cuántos cambios hubo, en cuántos productos y qué campos cambiaron.

---

## Usuarios del panel

Madre guarda los usuarios y las sesiones del panel interno. **El login lo hace `auth.api`**: Madre no calcula ni verifica contraseñas, solo guarda lo que `auth.api` le manda ya cifrado.

- Los emails se guardan en minúsculas, y no puede haber dos usuarios con el mismo.
- Una sesión renovable es válida mientras no esté revocada ni vencida. Cerrar sesión la revoca.
- Se registra la fecha del último ingreso.

---

## Productos para Google Shopping

Lista los productos activos de la tienda web, con todos sus datos, para armar el catálogo de Google Merchant Center. Los lee de la base de la tienda, no del catálogo madre.
