# Referencia de la API

Todos los endpoints del servicio, agrupados por área.

← [Volver al inicio](../README.md)

**URL base de producción:** `https://api.madre.loquieroaca.com`. Todas las rutas empiezan con `/api`.

Los ejemplos usan dos variables de entorno para no repetir la URL y la clave:

```bash
export MADRE_API_URL="https://api.madre.loquieroaca.com"
export INTERNAL_API_KEY="..."
```

**Contenido**

| Grupo | Ruta base | Pide clave |
|---|---|---|
| [Catálogo madre](#catálogo-madre) | `/api/products` · `/api/categories` · `/api/brands/madre` | No |
| [Publicaciones en marketplaces](#publicaciones-en-marketplaces) | `/api/internal/marketplace/products` · `/api/internal/product-sync/runs` | No |
| [SKUs pausados](#skus-pausados) | `/api/internal/marketplace/paused-skus` | **Sí** |
| [Publicador](#publicador) | `/api/publication-runs` · `/api/publication-jobs` | No |
| [Marcas de marketplaces](#marcas-de-marketplaces) | `/api/brands/:market/match` · `/api/matcher` | No |
| [Categorías de marketplaces](#categorías-de-marketplaces) | `/api/categories/fravega` · `/api/categories/megatone` | No |
| [Pedidos](#pedidos) | `/api/orders` | No |
| [Comprobantes de Xubio](#comprobantes-de-xubio) | `/api/internal/xubio/comprobantes` | **Sí** |
| [Ventas que no se pudieron facturar](#ventas-que-no-se-pudieron-facturar) | `/api/internal/invoice/client-issues` | **Sí** |
| [Publicaciones de MercadoLibre](#publicaciones-de-mercadolibre) | `/api/mercadolibre/*` | No |
| [Credenciales de MercadoLibre](#credenciales-de-mercadolibre) | `/api/internal/mercadolibre/token` | **Sí** |
| [Avance de sincronizaciones](#avance-de-sincronizaciones) | `/api/internal/sync-states` | No |
| [Foto de Automeli](#foto-de-automeli) | `/api/automeli/product-snapshots` | No |
| [Analítica](#analítica) | `/api/analytics/brands` · `/api/analytics/categories` · `/api/analytics/products` | No |
| [Carpetas de favoritos](#carpetas-de-favoritos) | `/api/analytics/marketplace-favorites` | No |
| [Ventas y aporte de MercadoLibre](#ventas-y-aporte-de-mercadolibre) | `/api/mercadolibre/orders` | No |
| [Central de Promociones](#central-de-promociones) | `/api/internal/central-promos/campaign-mlas` | **Sí** |
| [Impuestos por categoría](#impuestos-por-categoría) | `/api/internal/taxes/categories` | **Sí** |
| [Productos para Google Shopping](#productos-para-google-shopping) | `/api/internal/google-merchant/products` | **Sí** |
| [Planilla de control](#planilla-de-control) | `/api/internal/planilla-control` | No |
| [Cambios del catálogo](#cambios-del-catálogo) | `/api/internal/product-delta` | **Sí** |
| [Usuarios del panel](#usuarios-del-panel) | `/api/internal/auth` | **Sí** |

### Convenciones

- **Clave interna.** Los grupos marcados con **Sí** piden el header `x-internal-api-key`. Sin el header responden `401 Internal API key missing`; con una clave incorrecta, `401 Invalid internal API key`. Los demás no piden nada. Que una ruta empiece con `/internal` **no** significa que pida clave: guíese por esta tabla.
- **Códigos de respuesta.** Un `POST` responde **`201`**, aunque sea una consulta, salvo que se indique otro código. El resto responde `200`.
- **Datos inválidos.** Cuando el cuerpo tiene validación, un dato inválido responde `400` con la lista de problemas:

  ```json
  { "statusCode": 400, "message": ["skus must be an array"], "error": "Bad Request" }
  ```

  Los campos que no están en la definición se descartan sin aviso. Varios endpoints **no validan el cuerpo**: lo indica cada uno.
- **Errores propios.** Los `400` y `404` de cada endpoint traen el texto indicado en `message`. Cualquier otra falla responde `500 Internal server error`.
- **Paginado.** Salvo que se indique otra forma, los listados responden así:

  ```json
  { "items": [], "total": 120, "limit": 50, "offset": 0, "count": 50, "hasNext": true, "nextOffset": 50 }
  ```

  `count` es la cantidad de ítems de esta página. `nextOffset` es `null` en la última. Donde no se indica un máximo de `limit`, no lo hay. Un `limit` u `offset` negativo o que no es número termina en `500`.
- **SKUs y MLA.** Cuando un endpoint dice que **normaliza**, quita espacios, pasa a mayúsculas y elimina repetidos antes de buscar.
- **Tamaño del cuerpo.** Hasta 10 MB.

---

## Catálogo madre

Consulta del [catálogo madre](funcional.md#el-catálogo-madre). Solo lectura.

### Consultar precio, stock y estado de varios SKUs

```
POST /api/products/madre/status/bulk
```

**Body**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `skus` | string[] | Sí | SKUs a consultar. Se normalizan. Sin máximo. |

```bash
curl -s -X POST "$MADRE_API_URL/api/products/madre/status/bulk" \
  -H "Content-Type: application/json" \
  -d '{"skus":["B0953HLGJ3"]}'
```

**Respuesta**

```json
{
  "items": [
    { "sku": "B0953HLGJ3", "price": 150000, "amazonPrice": 89.99, "maxWeight": 1.2, "stock": 5, "status": "active" }
  ],
  "total": 1
}
```

- Los ítems vuelven en el orden pedido. `total` es la cantidad de SKUs pedidos, no de encontrados.
- Un SKU que no está en el catálogo vuelve con `price: 0`, `stock: 0` y el resto en `null`.

### Consultar las imágenes de varios SKUs

```
POST /api/products/madre/images/bulk
```

Mismo body que el anterior.

```json
{
  "items": [
    { "sku": "B09GK544PP", "images": [{ "position": 1, "url": "https://..." }] }
  ],
  "total": 1
}
```

Solo vuelven las imágenes cargadas, con su posición del 1 al 10. Un SKU inexistente vuelve con `images: []`.

### Listar el catálogo

```
GET /api/products/madre
```

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `limit` | `500` | Sin máximo. |
| `offset` | `0` | |
| `sku` | — | Busca SKUs que **contengan** el texto. |

Respuesta paginada, ordenada por ID. Cada producto:

```json
{
  "id": 1, "sku": "B0953HLGJ3", "title": "...", "description": "...",
  "categoryPath": "Ropa y Accesorios > Equipaje > Mochilas", "categoryMLA": "MLA1055", "categoryId": "MLA1055",
  "price": 150000, "stock": 5, "status": "active",
  "images": [{ "position": 1, "url": "https://..." }], "videoUrl": null,
  "attributes": { "brand": "Sony", "color": null, "model": null, "material": null, "size": null, "raw": { "marca": "Sony" } },
  "shippingTime": 10, "meliStatus": null, "amzStatus": null,
  "createdAt": "...", "updatedAt": "..."
}
```

El listado **no** trae el precio Amazon ni el peso: para eso está la consulta de estado de varios SKUs.

### Listar las categorías del catálogo

```
GET /api/categories
```

| Parámetro | Por defecto |
|---|---|
| `page` | `1` |
| `limit` | `50` |

Respuesta paginada con las rutas de categoría distintas del catálogo: `{ "id": 1, "sku": "B00CJQKSG4", "category": "Ropa y Accesorios > ..." }`. El `sku` es un ejemplo de la categoría.

### Listar las marcas del catálogo

```
GET /api/brands/madre
```

| Parámetro | Por defecto |
|---|---|
| `page` | `1` |
| `limit` | `20` |

Respuesta paginada con `items: [{ "id": 1, "name": "Sony" }]`, en orden alfabético. El `id` es solo la posición en el listado, no un identificador de la marca. Swagger documenta otra forma de respuesta; vale esta.

---

## Publicaciones en marketplaces

[Publicaciones en marketplaces](funcional.md#publicaciones-en-marketplaces): la foto del estado de cada SKU en Megatone, Frávega y OnCity, y el registro de cada corrida de sincronización. El marketplace se indica con su nombre en minúsculas (`megatone`); Madre no controla la lista.

### Cargar publicaciones de un marketplace

```
POST /api/internal/marketplace/products/bulk
```

Lo usan los procesos que leen cada marketplace. **No valida el cuerpo.**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `marketplace` | string | Sí | |
| `items[].externalId` | string | Sí | ID de la publicación en el marketplace. |
| `items[].sellerSku` | string | Sí | SKU propio. |
| `items[].marketplaceSku` | string | No | SKU del marketplace. |
| `items[].price` · `stock` · `status` | | Sí | Ver [estados](procesos.md#estado-de-una-publicación-en-un-marketplace). |
| `items[].raw` | object | No | Respuesta original del marketplace. |

- Cada publicación se busca por marketplace + `externalId`. Si no existe, se crea.
- Si existe y cambió el precio, el stock o el estado, se actualiza y se guarda una fila de historial. Si no cambió, solo se registra que se la vio.
- En una publicación existente **no** se actualizan `sellerSku` ni `marketplaceSku`.
- Todo el lote va en una transacción.

Responde `204` sin cuerpo. Errores: `400 marketplace es obligatorio` · `400 items must not be empty`.

### Ver un SKU en todos los marketplaces

```
GET /api/internal/marketplace/products/items/:sellerSku/marketplaces
```

```json
{
  "sellerSku": "B0CW2XFT87",
  "marketplaces": ["fravega", "megatone"],
  "priceByMarketplace": { "fravega": 12000, "megatone": 13000 },
  "stockByMarketplace": { "fravega": 2, "megatone": 1 },
  "statusByMarketplace": { "fravega": "ACTIVE", "megatone": "PAUSED" },
  "items": [
    { "marketplace": "megatone", "marketplaceSku": "MKT0001LQA", "externalId": "155562", "price": 13000, "stock": 1,
      "status": "PAUSED", "isActive": true, "lastSeenAt": "...", "updatedAt": "..." }
  ]
}
```

El SKU se compara **respetando mayúsculas**. Si no está en ningún marketplace: `404 No se encontraron marketplaces para sellerSku <sku>`.

### Listar SKUs con su foto por marketplace

```
GET /api/internal/marketplace/products/items/marketplaces
```

`limit` (por defecto `10`, máximo `100`) y `offset`. Respuesta paginada por SKU; cada ítem tiene la forma del endpoint anterior.

### Listar las publicaciones de un marketplace

```
GET /api/internal/marketplace/products/items/all
```

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `marketplace` | — **obligatorio** | |
| `limit` | `100` | Máximo `500`. |
| `offset` | `0` | |
| `sku` | — | SKUs que contengan el texto. |
| `status` | — | Estado exacto, sin distinguir mayúsculas. |

```json
{
  "marketplace": "megatone",
  "filters": { "sku": null, "status": "ACTIVE" },
  "items": [
    { "id": "uuid", "seller_sku": "B0...", "external_id": "155562", "price": "596398.95", "stock": 5,
      "status": "ACTIVE", "last_seen_at": "...", "raw_payload": "{...}" }
  ],
  "limit": 100, "offset": 0, "count": 100, "total": 376,
  "summary": {
    "marketplace": "megatone", "total": 376,
    "statuses": [{ "status": "ACTIVE", "total": 376, "percentage": 100 }],
    "statusMap": { "ACTIVE": 376 }, "statusPercentageMap": { "ACTIVE": 100 }
  },
  "hasNext": true, "nextOffset": 100
}
```

Los ítems vienen tal como están en la base. Sin `marketplace`: `400 marketplace query param is required`.

### Listar solo los SKUs de un marketplace

```
GET /api/internal/marketplace/products/items/skus
GET /api/internal/marketplace/products/items/ids-and-skus
```

Mismos parámetros que el anterior, salvo `sku` y `status`. El primero devuelve `items: ["B0...", ...]` y el segundo `items: [{ "id": "uuid", "sellerSku": "B0..." }]`. Los SKUs vacíos se descartan después de paginar, así que una página puede traer menos de `limit`.

### Saber si un SKU está en un marketplace

```
GET /api/internal/marketplace/products/items/exists?marketplace=megatone&sellerSku=B0CYQHG3SS
```

Responde `{ "exists": true }`. Acá el SKU se compara **sin** distinguir mayúsculas. Sin alguno de los dos parámetros: `400 marketplace and sellerSku are required`.

### Cantidad de publicaciones por estado

```
GET /api/internal/marketplace/products/:marketplace/status
```

Responde el `summary` del listado de publicaciones: total, cantidad y porcentaje por estado.

### Historial de un SKU en Megatone

```
GET /api/internal/marketplace/products/:sellerSku
```

Siempre consulta **Megatone**. Devuelve los cambios de precio, stock y estado, del más reciente al más viejo: `[{ "id", "product_sync_item_id", "price", "stock", "status", "raw_payload", "created_at" }]`. Si el SKU no está en Megatone, `[]`.

### Corregir a mano una publicación de Megatone

```
PUT /api/internal/marketplace/products/:sellerSku
```

Siempre actúa sobre **Megatone**. **No valida el cuerpo.**

| Campo | Descripción |
|---|---|
| `price` · `stock` · `status` | Los que se envían reemplazan a los actuales. |
| `raw` | Información adicional. |

- Si la publicación existe, se actualiza y deja historial si cambió precio, stock o estado.
- Si **no existe**, se crea una publicación de Megatone con ID `UNKNOWN-<sku>`, estado `ERROR` (se ignora el estado enviado) y la nota "Item no existe en product_sync_items".

Responde `{ "status": "UPDATED", "sellerSku": "B0CYQHG3SS" }` en los dos casos.

### Corridas de sincronización

Registran cada corrida que lee un marketplace. **No validan el cuerpo.** Ver [estados](procesos.md#corridas-de-sincronización-de-marketplaces).

| Endpoint | Body | Respuesta |
|---|---|---|
| `POST /api/internal/product-sync/runs/start` | `{ "marketplace": "megatone" }` | `201 { "runId": "uuid", "status": "RUNNING", "startedAt": "..." }` |
| `POST /api/internal/product-sync/runs/progress` | `{ "runId", "batches", "items", "failed" }`. Se **suman** a los contadores. | `204` |
| `POST /api/internal/product-sync/runs/finish` | `{ "runId", "status": "SUCCESS" }`. Se guarda cualquier valor. | `200 { "runId", "status", "finishedAt" }` |
| `POST /api/internal/product-sync/runs/fail` | `{ "runId", "errorMessage" }` | `200 { "runId", "status": "FAILED", "errorMessage", "finishedAt" }` |
| `GET /api/internal/product-sync/runs?marketplace=megatone` | `limit` (por defecto `20`, máximo `100`), `offset` | `{ "items": [...], "limit", "offset" }`, de la más reciente a la más vieja. Sin total. |

Errores: `400 marketplace es obligatorio` · `400 runId es obligatorio` · `400 runId y errorMessage son obligatorios`. Un `runId` inexistente no da error.

---

## SKUs pausados

[SKUs pausados a mano](funcional.md#skus-pausados-a-mano). **Pide clave.**

La ruta base es `/api/internal/marketplace/paused-skus`. También responde bajo `/api/internal/marketplace/products/paused-skus`, pero **no conviene usar esa**: ahí `GET` y `PUT` sobre la raíz los atiende otro endpoint.

Un registro:

```json
{ "id": 1, "sku": "B0C33CHG99", "paused": true, "createdAt": "...", "updatedAt": "..." }
```

Todos los SKUs se normalizan.

| Endpoint | Entrada | Respuesta |
|---|---|---|
| `PUT /` | `{ "sku": "B0C33CHG99", "paused": true }` | El registro. |
| `PUT /bulk` | `{ "items": [{ "sku", "paused" }] }`, de 1 a 1000. Si un SKU se repite, gana el último. | `{ "items": [registros], "total" }` |
| `PUT /:sku` | `{ "paused": true }`. **No valida el cuerpo**: cualquier valor no vacío, incluso el texto `"false"`, cuenta como pausado. | El registro. |
| `POST /bulk` | `{ "skus": [...] }`, de 1 a 1000. Es una **consulta**. | `200 { "items": [{ "sku", "paused" }], "total" }`. Un SKU sin registro vuelve con `paused: false`. |
| `GET /` | `sku` (contiene), `paused` (`true` o `1` para los pausados, cualquier otro valor para los no pausados), `limit` (por defecto `100`, máximo `500`), `offset` | Paginado de registros. |
| `GET /skus` | `limit` (por defecto `100`, máximo `500`), `offset` | Paginado de SKUs: `items: ["B0...", ...]`. |
| `GET /:sku` | | El registro, o `404 No se encontró configuración para sku <sku>`. |
| `DELETE /:sku` | | `{ "sku", "deleted": true }`, o el mismo `404`. Borra el registro. |

---

## Publicador

[El publicador](funcional.md#el-publicador): corridas de publicación masiva y sus tareas. Ver [estados](procesos.md#el-publicador).

### Crear una corrida

```
POST /api/publication-runs
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `marketplaces` | string[] | Sí | No vacía. Madre no controla los nombres. |

Responde `{ "run_id": 25, "status": "..." }`.

### Cargar tareas a una corrida

```
POST /api/publication-jobs
```

| Campo | Tipo | Obligatorio |
|---|---|---|
| `run_id` | entero | Sí |
| `jobs[].sku` | string | Sí |
| `jobs[].marketplace` | string | Sí |

Crea cada tarea en `pending` y suma la cantidad al total de la corrida. No controla que la corrida exista ni que la tarea esté repetida. Responde `{ "status": "ok", "jobs_created": 3 }`.

### Tomar tareas para publicar

```
POST /api/publication-jobs/claim
```

| Campo | Por defecto | Descripción |
|---|---|---|
| `limit` | `50` | Mínimo 1. Más de 50 se toma como 50. |

Toma las tareas `pending` más antiguas y las pasa a `processing`. Dos procesos que piden a la vez nunca reciben la misma tarea.

```json
{
  "requested": 80, "limit": 50, "claimed": 2,
  "items": [{ "id": 1, "run_id": 25, "sku": "SKU123", "marketplace": "megatone", "status": "processing" }]
}
```

### Informar el resultado de una tarea

```
PATCH /api/publication-jobs/:id
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `status` | Sí | `success`, `failed`, `retry`, `skipped`… Se guarda cualquier texto. |
| `marketplace_item_id` | No | ID de la publicación creada. |
| `error_message` | No | |
| `result` · `request_payload` · `response_payload` | No | Lo que se mandó y lo que respondió el marketplace. |

**Reemplaza todos los campos**: los que no se envían quedan vacíos. Responde `{ "status": "ok" }`, también si la tarea no existe.

### Reintentar las fallidas de una corrida

```
POST /api/publication-jobs/retry
```

Body `{ "run_id": 25 }`. Pasa las tareas `failed` a `pending` y les suma un intento. Responde `{ "status": "ok", "jobs_retried": 20 }`.

### Cancelar una corrida

```
POST /api/publication-runs/:id/cancel
```

Pasa a `cancelled` las tareas `pending` y la corrida. Responde `{ "status": "cancelled", "jobs_cancelled": 120 }`. No da error si la corrida no existe.

### Consultar corridas

```
GET /api/publication-runs
GET /api/publication-runs/:id
```

El primero lista todas las corridas, de la más reciente a la más vieja, sin paginar. El segundo devuelve una; si no existe, responde `200` **vacío**.

```json
{
  "id": 25, "status": "cancelled", "marketplaces": ["megatone", "fravega"],
  "total_jobs": 1000, "success_jobs": 300, "failed_jobs": 10,
  "pending_jobs": 0, "processing_jobs": 5, "skipped_jobs": 0, "cancelled_jobs": 685, "retry_jobs": 0,
  "created_at": "...", "started_at": null, "finished_at": "...", "metadata": null
}
```

Los contadores por estado se calculan en el momento. `total_jobs` es la suma de las tareas cargadas.

### Avance y detalle de una corrida

```
GET /api/publication-jobs/:id/progress
GET /api/publication-jobs/:id/jobs
```

En los dos, `:id` es el ID de la **corrida**.

- `progress` devuelve `{ "run_id", "total", "pending", "processing", "success", "failed", "skipped", "cancelled", "retry" }`. Los contadores pueden llegar como texto (`"120"`).
- `jobs` lista las tareas, con `limit` (por defecto `50`), `offset` y `status` para filtrar. Cada tarea trae intentos, error, lo enviado, lo respondido y el ID de la publicación.

### Ver las tareas pendientes

```
GET /api/publication-jobs/pending?limit=10
```

Lista las tareas `pending` más antiguas, sin tomarlas. Para publicar hay que usar [tomar tareas](#tomar-tareas-para-publicar).

---

## Marcas de marketplaces

[Marcas](funcional.md#marcas). **No validan el cuerpo.**

### Marca por SKU

```
GET  /api/brands/:market/match
POST /api/brands/:market/match
```

`:market` es `oncity`, `megatone` o `fravega`. Otro valor: `400 Validation failed (enum string is expected)`.

- **GET**, con `page` (por defecto `1`) y `limit` (por defecto `50`): respuesta paginada de `{ "sku": "B07XLV1XKC", "brandId": "2582", "brandName": "Samsonite" }`.
- **POST**, con un objeto o una lista de `{ "sku", "brandId", "brandName" }`: crea o actualiza la marca de cada SKU. Responde `{ "success": true }`.

### Marca de MercadoLibre a marca del marketplace

| Endpoint | Descripción |
|---|---|
| `POST /api/matcher/brands` | Guarda una equivalencia con **Frávega**: `{ "meliBrand", "fravegaBrandId", "fravegaBrandName", "confidence" }`. |
| `POST /api/matcher/brands/megatone` | Guarda una equivalencia con **Megatone**: `{ "meliBrand", "megatoneBrandId", "megatoneBrandName", "confidence" }`. |
| `GET /api/matcher/brands/fravega/meli/:meliBrand` | La equivalencia de una marca de MercadoLibre con Frávega. |
| `GET /api/matcher/brands/megatone/meli/:meliBrand` | Ídem con Megatone. |
| `GET /api/matcher/brands/fravega/:id/exists` | `{ "exists": true }` si el ID de marca de Frávega tiene alguna equivalencia. |
| `GET /api/matcher/brands/megatone/:id/exists` | Ídem con Megatone. |

- Los `POST` responden `200 { "status": "ok", "created": true }`. Siempre **agregan** una equivalencia nueva, no actualizan.
- Las consultas responden `{ "status": "ok", "data": { "id", "meli_brand", "fravega_brand_id", "fravega_brand_name", "confidence", "created_at" } }`. Si no hay: `404 No match found for meliBrand: <marca>`.

---

## Categorías de marketplaces

[Categorías](funcional.md#categorías). **No validan el cuerpo.**

### Frávega

| Endpoint | Respuesta |
|---|---|
| `GET /api/categories/fravega/tree` | El árbol completo: `[{ "id", "name", "children": [...] }]`. |
| `GET /api/categories/fravega/attributes/:categoryId` | Los atributos de la categoría: `[{ "id", "name", "type", "groupName", "description", "required", "options": [] }]`. |
| `GET /api/categories/fravega/match/:meliCategoryId` | `{ "meliCategoryId", "meliCategoryPath", "fravegaCategoryId", "fravegaCategoryPath" }`, o `200` vacío. |
| `GET /api/categories/fravega/match/exists/:meliCategoryId` | `{ "meliCategoryId", "exists": true }` |
| `GET /api/categories/fravega/match` | `page` (por defecto `1`), `limit` (por defecto `50`). Responde `{ "page", "limit", "count", "data": [...] }`, sin total. |
| `POST /api/categories/fravega/match` | Crea o actualiza una equivalencia. Responde `{ "success": true, "message": "Category match saved", "item" }`. |
| `POST /api/categories/fravega/match/bulk` | `{ "items": [...] }`. Responde `{ "success": true, "inserted": <cantidad enviada> }`. |

### Megatone

| Endpoint | Respuesta |
|---|---|
| `GET /api/categories/megatone/:meliCategoryId` | `{ "meliCategoryId", "meliCategoryPath", "megatoneCategoryId", "megatoneCategoryPath" }`, o `200` vacío. |
| `GET /api/categories/megatone/exists/:meliCategoryId` | `true` o `false`, sin objeto. |
| `GET /api/categories/megatone` | `limit` (por defecto `100`), `offset`. Responde una **lista**, sin paginado. |
| `POST /api/categories/megatone` | Crea o actualiza una equivalencia. Responde `{ "success": true }`. |
| `POST /api/categories/megatone/bulk` | `{ "items": [...] }`. Responde `{ "success": true }`. |

En los `bulk`, un cuerpo sin `items` termina en `500`.

---

## Pedidos

[Pedidos](funcional.md#pedidos) de los marketplaces. Los escribe y los lee `order-api`. Ver [estados](procesos.md#pedidos).

### Registrar pedidos

```
POST /api/orders/batch
```

Body `{ "orders": [...] }`. Cada pedido:

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `marketplace` | string | Sí | `fravega`, `megatone`, `oncity` o `mercadolibre`. |
| `external_order_id` | string | Sí | ID del pedido en el marketplace. |
| `unique_key` | string | Sí | `marketplace:ID`, por ejemplo `fravega:v90520163frvg-01`. |
| `source_payload` | object | Sí | El pedido original. |
| `external_suborder_id` | string | No | |
| `purchase_date` | string | No | Fecha ISO. Una fecha inválida se guarda vacía. |
| `estimated_delivery_date` | string | No | Fecha estimada de entrega, ISO. |
| `customer_name` · `customer_document` · `customer_phone` · `customer_email` | string | No | |
| `amount_total` | number | No | |
| `currency` | string | No | Vacía equivale a pesos. |
| `status` · `delivery_status` | string | No | Estados del marketplace, tal cual. |
| `items_quantity` | entero | No | |
| `shipping_address` · `shipping_city` · `shipping_province` · `shipping_zip_code` | string | No | |
| `normalized_payload` | object | No | |
| `source_schema_version` | string | No | |
| `persistence_status` | string | No | Por defecto `PENDING`. Ver [estados](procesos.md#pedidos). |
| `notification_system_b_status` · `floxu_code` · `vbi_sale_id` · `vbi_nro_venta` · `last_error` | string | No | El resultado del procesamiento, para registrar un pedido que ya se procesó sin tener que actualizarlo después. |

Un pedido cuya `unique_key` ya existe **se saltea**: no se actualiza.

```json
{ "status": "ok", "total": 10, "inserted": 7, "skipped": 3 }
```

### Listar pedidos

```
GET /api/orders
```

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `marketplace` | — | Ej. `fravega`. |
| `persistence_status` | — | Uno de los [estados](procesos.md#pedidos). |
| `from` · `to` | — | Fecha de compra desde y hasta, ISO, inclusive. |
| `search` | — | Busca el texto en la clave, los IDs del marketplace, el nombre, el documento y el email del comprador, y el código TLQV. |
| `limit` | `50` | Entre 1 y 200. |
| `offset` | `0` | |

Respuesta paginada, de la compra más reciente a la más vieja. Cada pedido trae todos sus campos **salvo** `source_payload` y `normalized_payload`: para verlos, [buscar el pedido](#buscar-un-pedido).

### Pedidos pendientes

```
GET /api/orders/pending?limit=50
```

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `limit` | `50` | Entre 1 y 200. |
| `marketplace` | — | Solo los de ese marketplace. |
| `afterId` | — | Solo los pedidos con ID mayor. Para pedir la página siguiente, pasar el `nextAfterId` de la anterior. |

Los pedidos en `PENDING`, en el orden en que se registraron. No los reserva: dos lectores ven los mismos.

```json
{ "limit": 200, "count": 200, "nextAfterId": 1234, "items": [ { "id": 1, "marketplace": "fravega", "unique_key": "fravega:v90520163frvg-01", "...": "..." } ] }
```

`nextAfterId` es `null` cuando la página vino incompleta: ya no hay más. Cada pedido trae todos sus campos, payloads incluidos. Un `afterId` que no es un entero positivo responde `400 afterId must be a non-negative integer`.

### Buscar un pedido

```
GET /api/orders/:uniqueKey
```

Responde `{ "exists": true, "order": { ... } }` o `{ "exists": false, "order": null }`. Nunca `404`.

Un pedido completo trae, además de lo registrado, los estados de procesamiento, `floxu_code`, `vbi_sale_id`, `vbi_nro_venta`, los datos de la factura (`invoice_number`, `invoice_url`, `invoice_date`), `last_error` y las fechas de la última actualización.

### Actualizar el avance de un pedido

```
PATCH /api/orders/:id/status
```

`:id` es el ID interno del pedido, no la `unique_key`. Todos los campos son opcionales y solo se cambian los que se envían:

| Campo | Descripción |
|---|---|
| `persistence_status` | `PENDING`, `PROCESSED_FLOXU`, `COMPLETED`, `CANCELLED` o `FAILED`. |
| `notification_system_a_status` | Cómo terminó el aviso a Flokzu. |
| `notification_system_b_status` | Cómo terminó el aviso a Azure Tasks. |
| `floxu_code` | El código TLQV que devolvió Flokzu. |
| `vbi_sale_id` · `vbi_nro_venta` | Los identificadores de la venta que devolvió VBI. |
| `status` · `delivery_status` | Estados del marketplace, tal cual. |
| `estimated_delivery_date` | Fecha estimada de entrega, ISO. |
| `last_error` | |

Siempre registra la hora de la actualización. Responde `{ "status": "ok" }`. Errores: `400 Validation failed (numeric string is expected)` si el ID no es un número · `404 Order <id> not found`.

---

## Comprobantes de Xubio

[Copia de los comprobantes de Xubio](funcional.md#copia-de-los-comprobantes-de-xubio). **Pide clave.** La usa `invoice.api`.

### Guardar comprobantes

```
POST /api/internal/xubio/comprobantes/upsert/batch
```

Responde **`200`**. Body `{ "items": [...] }`, de 1 a 500 comprobantes. Cada uno:

| Campo | Obligatorio | Descripción |
|---|---|---|
| `xubioTransactionId` | Sí | ID de la transacción en Xubio. Identifica al comprobante. |
| `fechaEmision` | Sí | |
| `rawDetailPayload` | Sí | El detalle tal como lo devuelve Xubio. |
| `documentKind` | No | `INVOICE`, `CREDIT_NOTE`, `FCE` o `UNKNOWN` (por defecto). |
| `tlqvCode` · `tlqvNumber` · `mlOrderId` | No | La venta asociada. |
| `numeroDocumento` · `tipoCodigo` · `tipoNombre` · `letraComprobante` · `descripcion` | No | |
| `cae` · `caeFechaVencimiento` · `fiscalmenteEmitido` | No | |
| `importeGravado` · `importeImpuestos` · `importeTotal` | No | Por defecto `0`. |
| Cliente, moneda, punto de venta, provincia, condición de pago y demás datos de Xubio | No | |
| `productItems` · `cobranzaItems` · `percepcionItems` | No | Cada ítem lleva `rawPayload`. |
| `source` | No | `api` (por defecto), `excel` o `manual`. |
| `syncRunId` | No | La sincronización que lo trajo. |

- Si el comprobante ya existe, se reemplaza completo, **incluidos sus conceptos, cobranzas y percepciones**. Un comprobante enviado sin `productItems` queda sin conceptos.
- Todo el lote va en una transacción: si falla uno, no se guarda ninguno.

```json
{ "total": 2, "inserted": 1, "updated": 1 }
```

Errores: `400 items must not be empty` · `400 items must contain no more than 500 elements`.

### Comprobantes de una venta

```
GET /api/internal/xubio/comprobantes/by-tlqv-code/:tlqvCode
```

Todos los comprobantes de la venta (facturas, notas de crédito y FCE), del más reciente al más viejo, con conceptos, cobranzas y percepciones.

```json
{
  "items": [
    {
      "id": 1, "xubioTransactionId": 76318348, "documentKind": "INVOICE", "numeroDocumento": "A-00008-00002667",
      "tlqvCode": "TLQV-22281", "mlOrderId": "2000019101982438", "fechaEmision": "...", "importeTotal": 150000,
      "cae": "...", "clienteCodigo": "30652957044", "clienteNombre": "...",
      "rawDetailPayload": {}, "productItems": [], "cobranzaItems": [], "percepcionItems": []
    }
  ],
  "total": 1
}
```

### ¿La venta tiene factura?

```
GET /api/internal/xubio/comprobantes/exists-by-tlqv-code/:tlqvCode
```

```json
{ "tlqvCode": "TLQV-7734", "exists": true }
```

`exists` es `true` si la venta tiene al menos una **factura con CAE**. **No descuenta las facturas anuladas por nota de crédito**: ver [Facturación](funcional.md#copia-de-los-comprobantes-de-xubio).

### Lo mismo para varias ventas

| Endpoint | Body | Respuesta |
|---|---|---|
| `POST /api/internal/xubio/comprobantes/by-tlqv-codes` | `{ "tlqvCodes": [...] }`, hasta 1000 | `{ "items": [comprobantes], "total" }` |
| `POST /api/internal/xubio/comprobantes/exists-by-tlqv-codes` | `{ "tlqvCodes": [...] }`, de 1 a 500 | `{ "items": [{ "tlqvCode", "exists" }], "total" }`, un ítem por código |

Los códigos se normalizan. Error: `400 tlqvCodes must not be empty`.

### Buscar comprobantes

```
GET /api/internal/xubio/comprobantes
```

| Parámetro | Descripción |
|---|---|
| `tlqvCode` · `numeroDocumento` · `clienteCodigo` · `mlOrderId` · `documentKind` | Coincidencia exacta. |
| `fechaDesde` · `fechaHasta` | Sobre la fecha de emisión, inclusive. |
| `includeChildren` | `true` para traer conceptos, cobranzas y percepciones. |
| `limit` | Por defecto `50`, entre 1 y 500. |
| `offset` | Por defecto `0`. |

Respuesta paginada.

### ¿El cliente ya está en Xubio?

```
POST /api/internal/xubio/comprobantes/clients/exists/bulk
```

Body `{ "clientCodes": ["30652957044"] }`, hasta 1000. Devuelve solo los que aparecen en algún comprobante:

```json
{ "items": [{ "clienteCodigo": "30652957044", "clienteXubioId": 123, "clienteNombre": "..." }], "total": 1 }
```

### Sincronizaciones

| Endpoint | Descripción |
|---|---|
| `POST /api/internal/xubio/comprobantes/sync-runs` | Registra una sincronización. |
| `PATCH /api/internal/xubio/comprobantes/sync-runs/:id` | Actualiza los campos enviados. |
| `GET /api/internal/xubio/comprobantes/sync-runs/:id` | La consulta. |

| Campo | Obligatorio al crear | Valores |
|---|---|---|
| `syncType` | Sí | `historical_backfill`, `daily_update`, `manual_retry` |
| `status` | Sí | `running`, `completed`, `failed`, `partial` |
| `fechaDesde` · `fechaHasta` | Sí | Fechas de la ventana. |
| `windowType` | Sí | `month`, `day`, `custom` |
| `totalListed` · `totalDetailRequests` · `totalInserted` · `totalUpdated` · `totalFailed` | No | Por defecto `0`. |
| `hasSaturatedWindows` · `errorMessage` · `metadata` · `finishedAt` | No | |

Responden la sincronización completa. Errores: `400 id is required` · `404 Sync run <id> not found`.

---

## Ventas que no se pudieron facturar

[Issues de facturación](funcional.md#ventas-que-no-se-pudieron-facturar). **Pide clave.** Ver [estados](procesos.md#ventas-que-no-se-pudieron-facturar).

Un issue:

```json
{
  "id": 123, "issueKey": "<sha256>", "tlqvCode": "TLQV-14921", "reason": "INVALID_FISCAL_DOCUMENT", "source": "tus_facturas",
  "status": "open", "severity": "medium", "saleNumber": "2000014853225236", "buyerName": "...", "email": "...",
  "documentoTipo": "CUIT", "documentoNro": "20-11111111-4", "documentoNroDigits": "20111111114",
  "message": "...", "messages": ["..."], "rawPayload": {}, "metadata": {},
  "firstSeenAt": "...", "lastSeenAt": "...", "occurrenceCount": 1,
  "resolvedAt": null, "resolvedBy": null, "resolutionNotes": null,
  "createdAt": "...", "updatedAt": "...", "deletedAt": null
}
```

### Registrar un issue

```
POST /api/internal/invoice/client-issues/upsert
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `tlqvCode` | Sí | Se pasa a mayúsculas. |
| `reason` | Sí | Código del motivo. Se pasa a mayúsculas. |
| `source` | Sí | Sistema donde falló. Se pasa a minúsculas. |
| `message` | Sí | |
| `severity` | No | Por defecto `medium`. |
| `saleNumber` · `buyerName` · `email` · `documentoTipo` · `documentoNro` · `documentoNroDigits` | No | |
| `messages` | No | string[] |
| `rawPayload` · `metadata` | No | object |

El issue se identifica por venta + motivo + sistema + documento del comprador. Si ya existe:

- suma una ocurrencia y actualiza la fecha de la última;
- **reemplaza** sus datos con los enviados: los opcionales que no se envían quedan vacíos y `severity` vuelve a `medium`;
- si estaba resuelto o ignorado, vuelve a `open`; si estaba borrado, reaparece.

Responde el issue con dos campos más: `created` y `updated`. Errores: `400 tlqvCode is required` · `reason is required` · `source is required` · `message is required`.

### Listar issues

```
GET /api/internal/invoice/client-issues
```

| Parámetro | Descripción |
|---|---|
| `tlqvCode` · `reason` · `source` · `status` · `documentoNroDigits` | Coincidencia exacta. |
| `limit` | Por defecto `100`, entre 1 y 500. |
| `offset` | Por defecto `0`. |

No incluye los borrados. Del visto más recientemente al más viejo.

```json
{ "items": [ { "id": 123, "...": "..." } ], "pagination": { "limit": 100, "offset": 0, "total": 12 } }
```

### Issues agrupados por cliente

```
GET /api/internal/invoice/client-issues/clients
```

Parámetros: `tlqvCode` (exacto), `buyerName` y `email` (contienen), `documentoNroDigits` (exacto), `limit` y `offset` como el anterior.

```json
{
  "items": [
    { "buyerName": "...", "email": "...", "documentoTipo": "CUIT", "documentoNro": "20-11111111-4", "documentoNroDigits": "20111111114",
      "firstSeenAt": "...", "lastSeenAt": "...", "issueCount": 3, "tlqvCode": "TLQV-9999" }
  ],
  "pagination": { "limit": 100, "offset": 0, "total": 1 }
}
```

`tlqvCode` es uno de los TLQV del cliente: el mayor alfabéticamente, no el más reciente.

### Issues de una venta y de un ID

| Endpoint | Respuesta |
|---|---|
| `GET /api/internal/invoice/client-issues/by-tlqv-code/:tlqvCode` | `{ "tlqvCode", "items": [issues] }`, sin los borrados. |
| `GET /api/internal/invoice/client-issues/:id` | El issue, **incluso si está borrado**. Si no existe: `404 Invoice client issue <id> not found`. |

### Resolver, ignorar o reabrir

```
PATCH /api/internal/invoice/client-issues/:id
```

| Campo | Descripción |
|---|---|
| `status` | `open`, `resolved` o `ignored`. |
| `resolvedBy` · `resolutionNotes` | Quién y por qué. |
| `severity` | |

- `resolved` guarda la fecha, quién y la nota. `ignored` guarda quién y la nota. `open` borra los tres.
- **Conviene enviar siempre `severity`**: si falta, queda vacía.
- Sin `status`, `resolvedBy` y `resolutionNotes` toman lo enviado, o quedan vacíos si no se envían.

Responde el issue actualizado. Errores: `400 body must not be empty` · `404 Invoice client issue <id> not found` (inexistente o borrado).

### Borrar

```
DELETE /api/internal/invoice/client-issues/:id
```

Lo oculta de los listados. Responde `{ "id": 123, "deleted": true }`. Vuelve si la venta falla otra vez por el mismo motivo.

---

## Publicaciones de MercadoLibre

La [copia de MercadoLibre](funcional.md#mercadolibre) que cargan los procesos de `mercadolibre-api`. **No validan el cuerpo**, salvo donde se indica.

### IDs de publicaciones

| Endpoint | Descripción |
|---|---|
| `POST /api/mercadolibre/items` | Body `{ "sellerId", "status", "items": ["MLA123", ...] }`. Crea o actualiza el estado de cada MLA. |
| `GET /api/mercadolibre/items` | Lista los MLA guardados. |
| `GET /api/mercadolibre/items/today` | Solo los que aparecieron por primera vez hoy. |

El `POST` responde `{ "inserted": N }`. `N` es la cantidad de filas que tocó la base: una actualización cuenta 2. Errores: `400 sellerId is required` · `400 status is required`.

Los `GET` paginan con un cursor: `limit` (por defecto `50`), `lastId` (el `lastId` de la página anterior), y filtros `sellerId` y `status`.

```json
{ "items": ["MLA123", "MLA456"], "limit": 50, "count": 2, "lastId": 1050, "hasNext": false }
```

### Detalle de publicaciones

| Endpoint | Descripción |
|---|---|
| `POST /api/mercadolibre/products` | Crea o actualiza publicaciones. |
| `PATCH /api/mercadolibre/products` | Actualiza publicaciones existentes. |
| `GET /api/mercadolibre/products` | Lista publicaciones. |
| `POST /api/mercadolibre/products/search` | Trae publicaciones por ID. |
| `POST /api/mercadolibre/products/categories/by-skus` | En qué publicaciones y categorías está cada SKU. |

**POST y PATCH** reciben `{ "sellerId", "products": [...] }`. Cada publicación: `id`, `categoryId`, `title`, `price`, `currency`, `stock`, `soldQuantity`, `status`, `condition`, `permalink`, `thumbnail`, `pictures`, `sellerSku`, `brand`, `warranty`, `freeShipping`, `health`, `lastUpdated`, `description`. Responden `{ "inserted": N }` y `{ "updated": N }`, contados como en los IDs.

> **El PATCH reemplaza la publicación completa.** Los campos que no se envían quedan vacíos o en cero. El ejemplo de Swagger, que manda solo precio, stock y estado, borra el título, las fotos, el SKU, la marca y la descripción. Siempre hay que mandar la publicación entera.

**GET**: `sellerId` (sin él trae todos los vendedores), `status`, `limit` (por defecto `50`) y `offset`. Respuesta paginada, de la más recientemente actualizada a la más vieja, con los campos como están en la base (`seller_id`, `sold_quantity`…).

**search**: body `{ "sellerId", "ids": ["MLA..."] }`. Devuelve la lista de las que existen.

**categories/by-skus**: body validado `{ "skus": [...] }`, con `limit` (por defecto `50`, entre 1 y 500) y `offset` en la URL. Los SKUs se normalizan y el paginado se aplica sobre la lista enviada.

```json
{
  "items": [
    { "sku": "B0C33CHG99", "matches": [{ "mlaId": "MLA1424202023", "categoryId": "MLA456045" }] },
    { "sku": "B001RCD2DW", "matches": [] }
  ],
  "total": 2, "limit": 50, "offset": 0, "count": 2, "hasNext": false, "nextOffset": null
}
```

### Visitas

| Endpoint | Descripción |
|---|---|
| `POST /api/mercadolibre/item-visits` | Body `{ "itemId": "MLA1424563181", "totalVisits": 177 }`. Guarda el total de una publicación. Responde `{ "saved": true }`. |
| `GET /api/mercadolibre/item-visits/:itemId` | `{ "itemId", "totalVisits", "createdAt", "updatedAt" }`, o `200` vacío. |
| `GET /api/mercadolibre/item-visits` | Paginado, `limit` (por defecto `50`) y `offset`. |

Errores: `400 itemId is required` · `400 totalVisits is required` · `400 limit must be greater than 0` · `400 offset must be >= 0`.

### Categorías

Una categoría:

```json
{ "id": "MLA9304", "name": "Souvenirs, Cotillón y Fiestas", "parentId": null, "level": 1, "path": "MLA9304", "isLeaf": false, "createdAt": "...", "updatedAt": "..." }
```

| Endpoint | Respuesta |
|---|---|
| `POST /api/mercadolibre/categories` | Body: una **lista** de `{ id, name, parentId, level, path, isLeaf }`. Responde `{ "saved": N }`. Lista vacía: `400 categories array is required`. |
| `GET /api/mercadolibre/categories` | Todas, por nivel y ruta. |
| `GET /api/mercadolibre/categories/parents` | Las de primer nivel. |
| `GET /api/mercadolibre/categories/children/list?parentId=MLA9304` | Las hijas directas. Sin `parentId`, las de primer nivel. |
| `GET /api/mercadolibre/categories/:id/subtree` | La categoría y todas sus descendientes. |
| `GET /api/mercadolibre/categories/:id` | Una categoría, o `200` vacío. |

---

## Credenciales de MercadoLibre

[Credenciales](funcional.md#mercadolibre). **Pide clave.** Un token vigente por aplicación (`appKey`, por defecto `default`).

| Endpoint | Descripción |
|---|---|
| `GET /api/internal/mercadolibre/token?appKey=default` | El token vigente, con access token y refresh token, o `200` vacío. |
| `GET /api/internal/mercadolibre/token/expired?appKey=default` | `{ "expired": true }` si no hay token o ya venció. No deja margen para renovar antes. |
| `POST /api/internal/mercadolibre/token` | Guarda un token nuevo. |

Body del `POST`:

| Campo | Obligatorio | Descripción |
|---|---|---|
| `access_token` | Sí | |
| `refresh_token` | Sí | |
| `expires_in` | Sí | Segundos de validez, como número mayor que cero. El vencimiento lo calcula Madre. |
| `app_key` | No | Por defecto `default`. |
| `client_id` | No | Por defecto, el `app_key`. |

Si ya hay un token para esa aplicación, lo reemplaza. Responde `{ "status": "ok" }`. Errores: `400 Token payload is required` · `access_token is required` · `refresh_token is required` · `expires_in must be a number greater than 0`.

---

## Avance de sincronizaciones

[Avance de las sincronizaciones](procesos.md#sincronizaciones-de-mercadolibre) de `mercadolibre-api`, por proceso y vendedor. **No validan el cuerpo.**

| Endpoint | Body | Efecto |
|---|---|---|
| `GET /api/internal/sync-states?process_name=items_id_sync&seller_id=1757836744` | | Devuelve el avance, o `200` vacío. |
| `POST /api/internal/sync-states/start` | `{ "process_name", "seller_id" }` | Arranca en la posición 0, `running`. |
| `POST /api/internal/sync-states/offset` | `{ "process_name", "seller_id", "last_offset" }` | Guarda la posición, `running`. |
| `POST /api/internal/sync-states/done` | `{ "process_name", "seller_id", "last_offset" }` | `done`. Sin `last_offset` guarda 0. |
| `POST /api/internal/sync-states/failed` | `{ "process_name", "seller_id", "last_offset" }` | `failed`. |

Los `POST` responden `{ "status": "ok" }`. El `GET` responde con nombres en camelCase, aunque Swagger muestre otros:

```json
{ "processName": "items_id_sync", "sellerId": "1757836744", "lastOffset": 1200, "status": "running", "updatedAt": "..." }
```

---

## Foto de Automeli

La [foto completa del catálogo de Automeli](funcional.md#mercadolibre), que guarda el sync de Automeli. Solo lectura.

Cada publicación trae: `mla`, `sku`, `brand`, `title`, `manufacturingTime`, `pauseReason`, `pausedSince`, `totalPrice`, `scrapedPrice`, `shippingCost`, `taxes`, `stockQuantity`, `amzStatus`, `changed`, `maxWeight`, `meliSalePrice`, `discountTotalPrice`, `meliStatus`, `listingTypeId`, `subStatus`, `appStatus`, `idMeliMainVariant`, `image`, `imageChanged`, `imageChangedUrl`, `permalink`, `meliCategoryName`, `meliMainCategory`, `shippingFrom`, `taxCategoryId`, `createUsingPublisher`, `dateUpdated`, `dateUpdatedMeli`, `createdAt`, `updatedAt`.

### Qué tan fresca está

```
GET /api/automeli/product-snapshots/last-updated
```

```json
{ "total": 726338, "lastCreatedAt": "2026-05-12T22:47:07.000Z", "lastUpdatedAt": "2026-06-17T18:00:05.000Z" }
```

### Buscar con filtros

```
GET /api/automeli/product-snapshots/all
```

| Parámetro | Descripción |
|---|---|
| `limit` · `offset` | Por defecto `50` y `0`. `limit` entre 1 y 500. |
| Campos de texto (`mla`, `sku`, `brand`, `title`, `amzStatus`, `meliStatus`, `listingTypeId`…) | Contienen el texto. |
| Campos numéricos (`totalPrice`, `stockQuantity`, `maxWeight`, `meliSalePrice`…) | Valor exacto, o rango con `<campo>Min` y `<campo>Max`. |
| Fechas (`pausedSince`, `dateUpdated`, `dateUpdatedMeli`, `createdAt`, `updatedAt`) | Rango con `<campo>From` y `<campo>To`, inclusive. |

Respuesta paginada, de la más recientemente actualizada a la más vieja.

### Consultar varios SKUs

```
GET  /api/automeli/product-snapshots?skus=B0BLHBC7JM,B0C33CHG99&fields=totalPrice,maxWeight&uniqueBySku=true
POST /api/automeli/product-snapshots/search
```

| Parámetro | Descripción |
|---|---|
| `skus` | SKUs a consultar, separados por coma o repetidos. Se normalizan. Sin máximo. |
| `fields` | Qué campos devolver. `sku` siempre viene. Los nombres desconocidos se ignoran. |
| `uniqueBySku` | `true` para una sola publicación por SKU: la Clásica (`gold_special`) más reciente; si no hay, la Premium (`gold_pro`); si no, la más reciente. |

El `POST` recibe lo mismo en el cuerpo, validado: `{ "skus": [...], "fields": [...], "uniqueBySku": true }`.

```json
{ "items": [{ "sku": "B0BLHBC7JM", "totalPrice": 59.01, "maxWeight": 1 }], "total": 1 }
```

---

## Analítica

[Analítica](funcional.md#analítica) sobre las publicaciones de MercadoLibre. En todas las respuestas, `orders` son **unidades vendidas** y `revenue` es **precio actual × unidades**.

### Marcas

```
GET /api/analytics/brands
```

| Parámetro | Por defecto | Valores |
|---|---|---|
| `page` | `1` | |
| `limit` | `20` | |
| `orderBy` | `orders` | `orders`, `visits`, `products` |
| `direction` | `desc` | `asc`, `desc` |

```json
{
  "meta": { "page": 1, "limit": 20, "total": 350, "totalPages": 18 },
  "items": [{ "brand": "COSORI", "totalProducts": 12, "totalOrders": 40, "totalVisits": 5000 }]
}
```

```
GET /api/analytics/brands/all
```

Todas las marcas en orden alfabético, con `page` (por defecto `1`) y `limit` (por defecto `50`). Responde `{ "meta": {...}, "items": [{ "brand": "ACME" }] }`.

### Categorías

Los resultados de estos endpoints se **guardan y se reutilizan** hasta que alguien llama a `invalidate`. Las métricas por categoría solo cuentan las publicaciones del vendedor `1757836744`, que está fijo en el código.

| Endpoint | Parámetros | Respuesta |
|---|---|---|
| `GET /api/analytics/categories` | `categoryId` (la rama), `orderBy` (`visits` por defecto, `orders`, `revenue`, `conversion`), `direction` | `[{ "categoryId", "categoryName", "totalProducts", "visits", "orders", "revenue", "avgTicket", "conversionRate" }]`, una fila por categoría final. Un `categoryId` inexistente devuelve **todas**. |
| `GET /api/analytics/categories/available` | | `[{ "id", "name" }]`: las categorías con al menos una publicación. No se guarda. |
| `GET /api/analytics/categories/parents-performance` | `orderBy` (`visits`, `orders`, `revenue`), `direction` | Una fila por categoría de primer nivel, sumando toda su rama. |
| `GET /api/analytics/categories/children?parentId=MLA5725` | `parentId` | `{ "summary": { "totalProducts", "totalVisits", "totalOrders", "totalRevenue" }, "items": [{ "categoryId", "categoryName", "level", "totalProducts", "visits", "orders", "revenue" }] }`. **Sin `parentId` responde `500`.** |
| `GET /api/analytics/categories/:categoryId/products` | ver abajo | Las publicaciones de la rama. |
| `POST /api/analytics/categories/invalidate` | | `{ "success": true }`. Descarta todos los resultados guardados. |

Parámetros de `:categoryId/products`:

| Parámetro | Descripción |
|---|---|
| `page` · `limit` | Por defecto `1` y `20`. `limit` entre 1 y 100. |
| `minPrice` · `maxPrice` · `minVisits` · `maxVisits` · `minOrders` · `maxOrders` · `minRevenue` · `maxRevenue` | Rangos. |
| `excludeMarketplace` | Marketplaces separados por coma. Excluye los SKUs ya publicados y activos ahí. |

```json
{
  "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3, "hasNext": true, "hasPrev": false },
  "items": [
    { "id": "MLA...", "title": "...", "thumbnail": "...", "seller_sku": "B0...", "price": 59999, "soldQuantity": 3, "visits": 120,
      "revenue": 179997, "isFavorite": false, "isPublished": true,
      "publishedMarketplaces": [{ "marketplace": "megatone", "status": "ACTIVE", "price": 65000, "stock": 2, "isActive": 1 }] }
  ]
}
```

Ordenado por `revenue`, de mayor a menor.

### Productos

Filtros, que van en la URL o dentro de `filters` en el cuerpo:

| Filtro | Descripción |
|---|---|
| `brand` | Marca exacta. |
| `categoryId` | Toda la rama de la categoría. |
| `minPrice` · `maxPrice` · `minVisits` · `maxVisits` · `minOrders` · `maxOrders` | Rangos. |
| `status` | Estado en MercadoLibre: `active`, `under_review`, `paused`, `closed`. |
| `marketplaceStatus` | `published` o `not_published`: si el SKU tiene una publicación activa en algún marketplace. |
| `excludeMarketplace` | Marketplaces a excluir, separados por coma. |
| `inMarketplace` | ID de una carpeta de favoritos: solo los SKUs que están en ella. |
| `matchedMarketplace` | `megatone` o `fravega`: la marca tiene equivalencia con confianza mayor a 0,8. |

Solo se cuentan publicaciones con [SKU válido](funcional.md#analítica).

| Endpoint | Respuesta |
|---|---|
| `GET /api/analytics/products/overview` | `{ "totalProducts", "totalOrders", "totalVisits", "totalRevenue", "avgPrice", "avgTicket" }`. `totalProducts` cuenta SKUs distintos. |
| `POST /api/analytics/products/save-selection` | Body `{ "marketplaceId": 3, "filters": {...} }`. Agrega a esa carpeta un producto por cada SKU que cumple el filtro. Responde `{ "success": true, "totalProcessed": 830 }`. **No controla que la carpeta exista ni que esté activa.** |
| `POST /api/analytics/products/segments` | Mismo body. Guarda el filtro y la lista de productos como segmento. Responde `{ "success": true, "segmentId": 17, "totalProducts": 830 }`. |
| `GET /api/analytics/products/categories` | Todas las categorías, con los campos como están en la base. |
| `GET /api/analytics/products/categories/search?q=walkie` | Hasta 50 categorías cuyo nombre contiene el texto. |
| `GET /api/analytics/products/brands?q=son` | Hasta 100 marcas que contienen el texto. |

---

## Carpetas de favoritos

[Carpetas de favoritos](funcional.md#carpetas-de-favoritos-y-segmentos). La ruta base es `/api/analytics/marketplace-favorites`. Una carpeta inexistente responde `404 Marketplace not found`, y una cerrada, `Marketplace is closed and cannot be modified`.

### Carpetas

| Endpoint | Entrada | Respuesta |
|---|---|---|
| `POST /marketplaces` | `{ "name": "megatone" }` | `{ "success": true }`. No devuelve el ID. |
| `GET /marketplaces` | | `[{ "id": 1, "name": "megatone", "status": "active" }]` |
| `PATCH /marketplaces/:id/status` | `{ "status": "closed" }` (`active` o `closed`) | `{ "success": true }` |
| `DELETE /marketplaces/:id` | | `{ "success": true }`. Borra la carpeta y sus productos. Si está cerrada: `400 Closed marketplace cannot be deleted`. |

### Productos de una carpeta

| Endpoint | Entrada | Respuesta |
|---|---|---|
| `POST /:id/favorites` | `{ "productId": "MLA...", "sellerSku": "B0..." }` | `{ "success": true }` |
| `POST /bulk` | `{ "marketplaceIds": [1, 2], "products": [{ "productId", "sellerSku" }] }` | `{ "success": true, "marketplacesAffected": 2, "itemsPerMarketplace": 2 }` |
| `GET /:id/favorites` | ver abajo | Paginado de productos. |
| `DELETE /:id/favorites/:productId` | | `{ "success": true }` |
| `DELETE /:id/favorites` | `{ "productIds": ["MLA..."] }` | `{ "success": true, "deleted": <cantidad enviada> }` |
| `POST /:id/cleanup-skus` | `{ "skus": ["B0..."] }` | Deja una publicación por SKU. `{ "success": true, "cleaned": N }`. Lista vacía: `400 SKUs array is required`. |

Parámetros de `GET /:id/favorites`: `brand`, `categoryId` (exacta, sin subcategorías), rangos `minPrice`/`maxPrice`, `minStock`/`maxStock`, `minVisits`/`maxVisits`, `minOrders`/`maxOrders`, `page` (por defecto `1`), `limit` (por defecto `20`), `sortBy` (`price`, `visits`, `soldQuantity`, `stock`) y `sortOrder`.

```json
{
  "data": [{ "id": "MLA...", "title": "...", "thumbnail": "...", "price": 59999, "stock": 3, "soldQuantity": 12,
             "brand": "...", "categoryId": "...", "seller_sku": "B0...", "visits": 300 }],
  "pagination": { "total": 120, "page": 1, "limit": 20, "totalPages": 6 }
}
```

### Resumen de una carpeta

| Endpoint | Respuesta |
|---|---|
| `GET /:id/overview` | `{ "totalProducts", "totalVisits", "totalOrders", "totalRevenue", "avgPrice", "avgTicket", "totalBrands", "totalCategories" }`. Una carpeta inexistente da todo en cero. |
| `GET /:id/brands` | `page`, `limit`, `search`. `{ "data": [{ "brand", "totalProducts" }], "pagination" }` |
| `GET /:id/categories` | `page`, `limit`, `search`. `{ "data": [{ "categoryId", "categoryName", "level", "totalProducts", "path" }], "pagination" }` |

---

## Ventas y aporte de MercadoLibre

[Ventas y aporte de MercadoLibre](funcional.md#ventas-y-aporte-de-mercadolibre). Solo ventas con aporte distinto de cero.

Parámetros comunes:

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `fromDate` | `2026-05-01 00:00:00` | Fecha de venta desde, inclusive. |
| `toDate` | — | Fecha de venta hasta, inclusive. Una fecha sin hora corta a las 00:00 de ese día. |
| `status` | — | Estado de la orden, sin distinguir mayúsculas. |
| `limit` | `50` | Máximo `500`. |
| `offset` | `0` | |

| Endpoint | Fechas | Respuesta |
|---|---|---|
| `GET /api/mercadolibre/orders/aporte-ml` | No: siempre desde el 1 de mayo de 2026 | Paginado con todos los datos de la venta, comprador incluido. |
| `GET /api/mercadolibre/orders/aporte-ml/nro-venta` | No | Paginado de `{ "nroVenta", "aporteMl", "fechaVenta" }`. |
| `GET /api/mercadolibre/orders/aporte-ml/nro-venta/date-range` | Sí | Ídem, con fechas. |
| `GET /api/mercadolibre/orders/analytics/overview` | Sí | `{ "totalOrders", "totalAporteMl", "avgAporteMl", "totalRevenue", "avgTicket" }`. Acá `totalRevenue` es la suma de los precios de venta. |
| `GET /api/mercadolibre/orders/analytics/aporte-ml/timeseries` | Sí | `groupBy=month` para agrupar por mes, si no por día. `{ "items": [{ "date": "2026-05-02", "aporteMl", "orders", "revenue" }] }` |
| `GET /api/mercadolibre/orders/analytics/by-status` | Sí, sin `status` | `{ "items": [{ "status": "paid", "orders", "aporteMl", "revenue" }] }` |

Una venta del listado completo:

```json
{
  "id": 10, "nroVenta": "2000011386890188", "sku": "B00BRFIJ2S", "estadoOrden": "paid", "fechaVenta": "2026-05-02T10:12:00.000Z",
  "precioVenta": 150000, "saldoMercadolibre": 120000, "comisionMl": 20000, "cuotasMl": 5000, "aporteMl": 4200,
  "costoEnvio": 0, "impuestos": 0, "cantidadUnidades": 1, "nombreProducto": "...", "linkMl": "...", "linkAmazon": "...",
  "cuitComprador": "...", "nombreDestinatario": "...", "direccionCliente": "...", "ciudad": "...", "provincia": "...", "codigoPostal": "...",
  "tipoVenta": "...", "envioDomestico": "...", "paymentId": "...", "flokzuIdentifier": "...", "fechaEntrega": null, "buyerId": "...",
  "createdAt": "...", "updatedAt": "..."
}
```

---

## Central de Promociones

[Central de Promociones](funcional.md#central-de-promociones). **Pide clave.** Los MLA se normalizan.

| Endpoint | Entrada | Respuesta |
|---|---|---|
| `POST /api/internal/central-promos/campaign-mlas` | `{ "mla": "MLA123456789" }` | El registro: `{ "id", "mla", "created_at", "updated_at" }`. Si ya estaba, solo actualiza la fecha. |
| `POST /api/internal/central-promos/campaign-mlas/bulk` | `{ "mlas": [...] }`, de 1 a 1000 | `{ "status": "ok", "totalReceived": 2, "affectedRows": 3 }` |
| `GET /api/internal/central-promos/campaign-mlas` | `limit` (por defecto `10`, entre 1 y 100), `offset` | Paginado, del más reciente al más viejo. |
| `POST /api/internal/central-promos/campaign-mlas/exists/bulk` | `{ "mlas": [...] }` | `{ "items": [{ "mla", "exists": true }], "total" }`. **Siempre responde `exists: true`**, sin consultar la lista. |

Errores: `400 mla is required` · `400 mlas must contain at least one item` · `400 mlas must contain at most 1000 items`.

---

## Impuestos por categoría

[Impuestos por categoría](funcional.md#impuestos-por-categoría). **Pide clave.**

```
POST /api/internal/taxes/categories/by-mla
```

Body `{ "mla": "MLA1055" }`. Se normaliza.

```json
{
  "id": 1, "id_mla": "MLA1055", "categoria_arancelaria": "8517.13.00", "die": 16, "te": 3, "iva": 21, "derechos": null,
  "composicion_conf_automeli_iva": null, "composicion_conf_automeli_imp2": null, "composicion_conf_automeli_imp3": null,
  "compuesto": null, "codigo_categoria_automeli": null
}
```

Errores: `400 mla is required` · `404 No taxes category found for MLA <mla>`.

---

## Productos para Google Shopping

[Productos para Google Shopping](funcional.md#productos-para-google-shopping). **Pide clave.**

```
GET /api/internal/google-merchant/products/active
```

`limit` (por defecto `50`, entre 1 y 500) y `offset`. Respuesta paginada con los productos activos de la tienda web, del más nuevo al más viejo, con todos sus campos.

---

## Planilla de control

[Planilla de control](funcional.md#planilla-de-control). La usa `spreadsheet.tlq`. **No valida el cuerpo** con el mecanismo general: hace sus propios controles.

| Endpoint | Entrada | Respuesta |
|---|---|---|
| `POST /api/internal/planilla-control` | Una fila: `id` (o `Identificador`) y las columnas | La fila guardada. |
| `GET /api/internal/planilla-control` | `identificador` y `sku` (contienen), `limit` (por defecto `50`, entre 1 y 500), `offset` | Paginado, de la más reciente a la más vieja. |
| `GET /api/internal/planilla-control/:id` | | La fila. |
| `PATCH /api/internal/planilla-control/:id` | Las columnas a cambiar | La fila actualizada. No cambia el `id`. |
| `DELETE /api/internal/planilla-control/:id` | | `{ "success": true, "id": "TLQV-101" }`. La borra. |

- Las columnas se pueden mandar con el nombre normalizado (`nro_venta`, `estado_bue`) o con el encabezado original de la planilla (`NROVENTA`, `ESTADO BUE`). Las que no corresponden a ninguna columna se descartan.
- Crear una fila con un `id` que ya existe termina en `500`.

Errores: `400 El body debe incluir id o Identificador.` · `400 El body no contiene columnas válidas. Usá claves snake_case normalizadas o nombres originales de la planilla.` · `404 No se encontró registro de planilla_control con id <id>`.

---

## Cambios del catálogo

[Cambios del catálogo](funcional.md#cambios-del-catálogo). **Pide clave.**

### Leer cambios

```
GET /api/internal/product-delta/changes?after_id=0&limit=1000
```

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `after_id` | `0` | Devuelve los cambios **posteriores** a este. |
| `limit` | `1000` | Entre 1 y 5000. |

```json
{
  "items": [
    { "id": 101, "productoId": 5, "sku": "B0...", "campo": "precio", "valorAnterior": "100", "valorNuevo": "120",
      "operacion": "...", "origen": "...", "loteId": null, "hashIdem": null, "createdAt": "..." }
  ],
  "lastId": 101,
  "hasMore": false
}
```

Para seguir leyendo, pasar `lastId` como `after_id`.

### Hasta dónde leyó cada servicio

| Endpoint | Entrada | Respuesta |
|---|---|---|
| `GET /api/internal/product-delta/cursor?sync_key=products_api_delta` | | `{ "sync_key", "last_delta_id" }`. `0` si nunca leyó. Sin `sync_key`: `400 sync_key is required`. |
| `POST /api/internal/product-delta/cursor` | `{ "sync_key": "products_api_delta", "last_delta_id": 101 }` | `200`, con el valor guardado. Si el enviado es menor al que había, queda el anterior. |

### Actividad reciente

| Endpoint | Parámetros | Respuesta |
|---|---|---|
| `GET /api/internal/product-delta/summary` | `minutes` (por defecto `360`, entre 1 y 10080) | `{ "minutes", "totalChanges", "totalProducts", "lastChangeAt" }` |
| `GET /api/internal/product-delta/products` | `minutes`, `limit` (por defecto `100`, entre 1 y 5000), `offset` | Paginado de `{ "productoId", "sku", "changesCount", "lastChangeAt", "fields": ["precio", "stock"] }` |

---

## Usuarios del panel

[Usuarios del panel](funcional.md#usuarios-del-panel). **Pide clave.** Los usa `auth.api`, que es quien cifra las contraseñas y los tokens.

| Endpoint | Body | Respuesta |
|---|---|---|
| `POST /api/internal/auth/users` | `{ "email", "passwordHash", "name", "role", "isActive" }` (`isActive` por defecto `true`) | `{ "id", "email", "name", "role", "isActive" }` |
| `POST /api/internal/auth/find-user-by-email` | `{ "email" }` | El usuario **con** `passwordHash`, para que `auth.api` verifique la contraseña. |
| `GET /api/internal/auth/users/:id` | | El usuario, sin `passwordHash`. |
| `POST /api/internal/auth/users/:id/last-login` | | `{ "success": true }` |
| `POST /api/internal/auth/refresh-tokens` | `{ "userId", "tokenHash", "expiresAt", "userAgent", "ip" }` | `{ "id", "userId", "expiresAt", "revokedAt": null }` |
| `POST /api/internal/auth/refresh-tokens/find-valid` | `{ "tokenHash" }` | La sesión vigente más reciente con ese token. |
| `POST /api/internal/auth/refresh-tokens/revoke` | `{ "tokenHash" }` | `{ "success": true }`. Revoca todas las sesiones con ese token. |

Los emails se guardan en minúsculas. Errores: `400 User already exists` · `404 User not found` · `404 Valid refresh token not found` · `404 Refresh token not found` (también si ya estaba revocado) · `400 email is required` · `400 tokenHash is required`.
