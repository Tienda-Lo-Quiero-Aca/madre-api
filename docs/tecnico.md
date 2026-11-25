# Arquitectura y configuración

Cómo está armado el código, dónde guarda los datos, con qué servicios habla y cómo se configura.

← [Volver al inicio](../README.md)

**Contenido**

1. [Capas del código](#capas-del-código)
2. [Dónde está cada cosa](#dónde-está-cada-cosa)
3. [Procesos](#procesos)
4. [Base de datos](#base-de-datos)
5. [Redis](#redis)
6. [Integraciones](#integraciones)
7. [Variables de entorno](#variables-de-entorno)
8. [Sitio de documentación](#sitio-de-documentación)
9. [Tests](#tests)
10. [Limitaciones conocidas](#limitaciones-conocidas)

---

## Capas del código

NestJS 11. La mayor parte del servicio son endpoints que leen y escriben en MySQL con SQL directo: no hay entidades de TypeORM, solo `EntityManager.query()`.

```
src/
├── main.ts                 Servicio HTTP: prefijo /api, Swagger, sitio /docs
├── worker.ts               Proceso aparte: sync de Automeli
├── cli/                    Corridas manuales de los procesos de sincronización
├── core/                   Lógica de las sincronizaciones
│   ├── entities/           Tipos (producto madre, producto de Automeli, publicación de MercadoLibre…)
│   ├── adapters/           Interfaces de repositorios, cachés y locks
│   ├── drivers/            Clientes HTTP de Automeli y de mercadolibre-api
│   └── interactors/        Sync Automeli, import MercadoLibre, completar pesos, huellas de cambio
└── app/                    Todo lo que es NestJS
    ├── controller/         Endpoints y sus DTOs. También los dos crons.
    ├── services/           Lógica de cada área: acá está casi todo el negocio
    ├── module/             Un módulo por área: une cada interfaz con su repositorio SQL
    ├── driver/             Repositorios SQL, locks y huellas en Redis, sitio de documentación
    └── guards/             Clave interna (x-internal-api-key)
```

El recorrido típico de un endpoint es `controller → service → repositorio SQL`. Los repositorios se inyectan por nombre (`'IProductMadreRepository'`) y se definen en el módulo de cada área.

`src/core` se usa solo para las sincronizaciones del catálogo. Algunas interfaces de `core/adapters` importan tipos de `src/app`, así que la separación no es estricta.

**Regla práctica:** un cambio de qué se guarda o qué se responde va en el `service` y el repositorio SQL del área. Un cambio en las sincronizaciones del catálogo va en `core/interactors`.

---

## Dónde está cada cosa

| Necesito cambiar… | Archivo |
|---|---|
| Puerto, CORS, prefijo, tamaño del cuerpo, validación global | `main.ts` |
| Qué módulos carga el servicio | `app/app.module.ts` |
| Qué corre el worker | `worker.ts`, `app/module/madre/sync/AutomeliSyncWorker.module.ts` |
| Horario del sync de Automeli | `app/controller/madre/sync/AutomeliSyncCron.Controller.ts` |
| Horario del import de MercadoLibre | `app/controller/madre/sync/MeliProductsImportCron.Controller.ts` |
| Sync de Automeli: filtro de publicaciones, regla de estado, reintentos | `core/interactors/madre/SyncMadreDbFromAutomeli.ts` |
| Qué campos cuentan como cambio en Automeli | `core/interactors/madre/ProductStateHasher.ts` |
| Import de MercadoLibre: lotes, estado, armado del producto | `core/interactors/madre/SyncMadreDbFromMeliProductsDb.ts` |
| Qué campos cuentan como cambio en MercadoLibre | `core/interactors/madre/MeliProductImportHasher.ts` |
| Qué publicación se elige cuando un SKU tiene varias | `app/driver/repositories/mercadolibre/itemsDetails/SQLMercadoLibreProductsRepository.ts` (`findDeduplicatedBySku`) |
| SQL que escribe el catálogo madre | `app/driver/repositories/madre/products/SQLProductMadreRepository.ts` |
| Llamada a Automeli y mapeo de sus campos | `core/drivers/repositories/automeli/products/` |
| Llamadas a mercadolibre-api | `core/drivers/repositories/meliapi/` |
| Locks de las sincronizaciones | `app/driver/locks/redis/` |
| Huellas de cambio en Redis | `app/driver/cache/redis/` |
| Conexión a Redis | `app/module/RedisClient.module.ts` |
| Conexión a la base de impuestos | `app/module/taxes/TaxesCategories.Module.ts` |
| Clave interna | `app/guards/internal-api-key.guard.ts`, y `@UseGuards` en cada controller |
| Swagger | `common/swagger/swagger.setup.ts` |
| Sitio de documentación: páginas publicadas y menú | `app/driver/docs/docs-site.router.ts` |
| Deploy | `.github/workflows/deploy.yml` |

---

## Procesos

| Proceso | Entrada | Qué corre | Cómo se arranca |
|---|---|---|---|
| **Servicio HTTP** | `dist/main.js` | Todos los endpoints, el sitio `/docs` y el cron del import de MercadoLibre | `npm run start:prod`. En producción, PM2 con el nombre `madre-api`. |
| **Worker** | `dist/worker.js` | Solo el cron del sync de Automeli | `npm run start:worker`. El deploy automático **no** lo arranca: ver [Operación](operacion.md). |
| `npm run sync:once` | `src/cli/run-automeli-sync.ts` | Una corrida del sync de Automeli | A mano. |
| `npm run sync:weights:once` | `src/cli/run-automeli-weight-backfill.ts` | Completar pesos faltantes | A mano. |
| `npm run sync:products` | `src/cli/run-product-sync.ts` | Una corrida del import de MercadoLibre | A mano. Levanta el servicio entero, crons incluidos, mientras dura. |

Los comandos `sync:*` usan `ts-node`, así que necesitan las dependencias de desarrollo instaladas.

### Crons

| Cron | Horario | Proceso | Lock en Redis |
|---|---|---|---|
| Sync Automeli | `0 0 0,6,12,18 * * *`, hora de Buenos Aires | Worker | `automeli_sync:running` |
| Import MercadoLibre | `0 0 0,6,12,18 * * *`, hora de Buenos Aires | Servicio HTTP | `meli_products_import:running` |

El funcionamiento de cada uno está en [Procesos y estados](procesos.md#las-sincronizaciones-del-catálogo).

**El import de MercadoLibre se dispara tres veces** en cada horario: el servicio registra `ScheduleModule.forRoot()` en tres módulos distintos, y cada registro programa el cron otra vez. El lock hace que dos de las tres salgan enseguida con `Another import is already running. Skipping.`

---

## Base de datos

### Conexiones

| Conexión | Variables | Qué tiene |
|---|---|---|
| Principal | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | Todo, salvo lo de abajo. |
| `taxes` | `TAXES_DB_*` | Impuestos por categoría (`ml_categories`) y productos de la tienda web (`tlq.products`). |

- La conexión principal se declara con `TypeOrmModule.forRoot` **en cada módulo** (13 veces en el servicio HTTP, 1 en el worker), copiando la misma configuración. Cada declaración abre su propio grupo de conexiones.
- Varias consultas nombran el esquema `defaultdb` de forma explícita, sin importar `DB_NAME`.
- No hay migraciones en el repositorio: las tablas, los índices únicos y los valores por defecto de las columnas viven solo en la base. Varias operaciones dependen de índices únicos que no se pueden ver desde el código, como la clave de un pedido, el ID de transacción de Xubio, la clave de un issue o el email de un usuario.

### Tablas

| Área | Tablas |
|---|---|
| Catálogo madre | `productos_madre` · `productos_madre_delta` · `delta_sync_cursor` · `automeli_product_snapshots` |
| Publicaciones en marketplaces | `product_sync_items` · `product_sync_history` · `product_sync_runs` · `product_sync_sku_pause_flags` |
| Publicador | `publication_runs` · `publication_jobs` |
| Marcas | `brand_match_oncity` · `brands_match_megatone` · `brand_match_fravega` · `meli_fravega_match_brand` · `meli_megatone_match_brand` |
| Categorías | `fravega_categories` · `fravega_category_attributes` · `meli_fravega_category_match` · `meli_megatone_category_match` |
| Pedidos | `development_orders` (es la tabla de producción, pese al nombre) |
| Ventas de MercadoLibre | `orders` (la carga otro proceso) |
| MercadoLibre | `mercadolibre_items` · `mercadolibre_products` · `mercadolibre_item_visits` · `mercadolibre_categories` · `mercadolibre_tokens` · `sync_states` |
| Analítica | `analytics_cache` · `analytics_metadata` · `marketplaces` · `marketplace_favorite_products` · `marketplace_filter_segments` · `marketplace_segment_products` |
| Facturación | `xubio_comprobantes` · `xubio_comprobante_product_items` · `xubio_comprobante_cobranza_items` · `xubio_comprobante_percepcion_items` · `xubio_comprobante_sync_runs` · `invoice_client_issues` |
| Operación | `planilla_control` · `promotion_campaign_mlas` |
| Usuarios | `auth_users` · `auth_refresh_tokens` |
| Base `taxes` | `ml_categories` · `tlq.products` |

### Resultados guardados de la analítica

Los endpoints de analítica por categoría guardan su respuesta en `analytics_cache`. La clave es un hash de la consulta, y cada resultado lleva el número de versión vigente de `analytics_metadata`. `POST /api/analytics/categories/invalidate` sube la versión, y con eso todos los resultados guardados dejan de usarse. Las filas viejas no se borran.

---

## Redis

El servicio **no arranca sin Redis**: tanto el servicio HTTP como el worker lo necesitan para los locks. La conexión usa siempre TLS.

| Clave | Tipo | Vence | Para qué |
|---|---|---|---|
| `automeli_sync:running` | texto | 4 horas | Lock del sync de Automeli y de completar pesos. |
| `meli_products_import:running` | texto | 4 horas | Lock del import de MercadoLibre. |
| `automeli_products_state` | hash SKU → huella | Nunca | Última versión de cada SKU vista en Automeli. |
| `meli_products_import_state` | hash SKU → huella | Nunca | Última versión de cada SKU vista en MercadoLibre. |

- Los locks se borran al terminar la corrida, haya salido bien o mal. Si el proceso muere a mitad de camino, el lock queda hasta que vence.
- Borrar un hash de huellas hace que la próxima corrida reescriba **todos** los SKUs.

---

## Integraciones

| Servicio | Para qué | Qué se llama |
|---|---|---|
| **Automeli** | Catálogo de productos Amazon publicados en MercadoLibre | `GET {AUTOMELI_BASE_URL}/get-products-cursor/?seller_id=…&app_status=2&cursor=…` |
| **mercadolibre-api** | Descripción y ruta de categoría de cada publicación | `GET {MELI_GATEWAY_BASE_URL}/meli/products/{id}/description` · `GET {MELI_GATEWAY_BASE_URL}/meli/categories/{id}/raw` |
| **MySQL** | Todos los datos | Conexión principal y `taxes`. |
| **Redis** | Locks y huellas de cambio | ioredis, con TLS. |

**Automeli.** Cada página se pide hasta 3 veces, con esperas de 0,5 y 1 segundo. No hay timeout ni autenticación. El peso viene en el campo `max_weigth`, con el error de tipeo de Automeli.

**mercadolibre-api.** Sin autenticación ni timeout. Hasta 3 intentos por pedido; un `404` no se reintenta. Las rutas de categoría se recuerdan en memoria mientras el proceso esté vivo, incluidas las que fallaron, que quedan vacías. El servicio nunca llama directo a la API de MercadoLibre.

**Google.** Las dependencias de Google (`googleapis`, `google-spreadsheet`, `google-auth-library`) están instaladas pero el código no las usa. Los productos para Google Shopping salen de la base `taxes`, sin llamar a Google.

---

## Variables de entorno

El servicio lee `.env` del directorio desde el que arranca. La plantilla está en `.env.example`.

### Servicio

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Si falta, el log de arranque dice 3001, pero escucha en 3000. |
| `INTERNAL_API_KEY` | — **obligatoria** | Clave del header `x-internal-api-key`. Sin ella, todo endpoint con clave responde `401`. |
| `MADRE_BODY_LIMIT` | `10mb` | Tamaño máximo del cuerpo. |
| `DOCS_SITE_ENABLED` | `true` | Publica esta documentación en `/docs`. |
| `DOCS_SITE_PATH` | `/docs` | |
| `DOCS_SITE_USER` · `DOCS_SITE_PASSWORD` | — | Si están las dos, el sitio pide usuario y clave y publica todas las páginas. Sin ellas queda abierto y no publica la de operación. |

### Base de datos

| Variable | Por defecto | Descripción |
|---|---|---|
| `DB_HOST` · `DB_PORT` · `DB_USER` · `DB_PASS` · `DB_NAME` | — **obligatorias** | Conexión principal. |
| `TAXES_DB_HOST` · `TAXES_DB_USERNAME` · `TAXES_DB_PASSWORD` | — **definirlas siempre** | Base de impuestos. |
| `TAXES_DB_PORT` | `3306` | |
| `TAXES_DB_DATABASE` | `tlq` | |

`DB_SSL`, `DB_SYNC` y `DB_LOGGING` aparecen en algunos `.env` pero **el código no las lee**.

### Redis

| Variable | Por defecto | Descripción |
|---|---|---|
| `REDIS_HOST` · `REDIS_PORT` | — **obligatorias** | Sin ellas el servicio no arranca: `[REDIS_CLIENT] Missing REDIS_HOST/REDIS_PORT.` |
| `REDIS_USERNAME` · `REDIS_PASSWORD` | — | |

### Sincronizaciones

| Variable | Por defecto | Descripción |
|---|---|---|
| `AUTOMELI_BASE_URL` | — **obligatoria para el worker** | Sin ella el sync de Automeli falla. |
| `AUTOMELI_SELLER_ID` | `1757836744` | Vendedor cuyos productos se piden a Automeli. |
| `MELI_GATEWAY_BASE_URL` | `https://api.meli.loquieroaca.com` | mercadolibre-api. |

---

## Sitio de documentación

El servicio publica `README.md` y `docs/*.md` en `/docs`, con un menú lateral por sección y buscador. El sitio usa [Docsify](https://docsify.js.org), y los diagramas, Mermaid; los dos se cargan desde `cdn.jsdelivr.net`.

- **El texto se lee del repositorio en cada visita.** Para publicar un cambio de documentación alcanza con `git pull`, sin compilar ni reiniciar.
- **Las rutas copian la estructura del repositorio**: el README en la raíz y el resto bajo `docs/`. Así los enlaces relativos entre los `.md` funcionan igual en el sitio y en GitHub.
- **Solo se sirven los archivos de la lista `DOCS_PAGES`** en `docs-site.router.ts`. Nada más del repositorio se puede pedir por esta vía. Para agregar una página, hay que sumarla ahí.
- **Sin usuario y clave** el sitio queda abierto y la página de operación muestra un aviso en lugar del contenido. Con `DOCS_SITE_USER` y `DOCS_SITE_PASSWORD` pide credenciales y publica todo.
- **Los títulos no pueden empezar con un número.** Docsify le antepone `_` al ID de esos títulos, y los enlaces a esas secciones funcionan en GitHub pero no en el sitio. Tampoco conviene usar `/` ni `—` en títulos que se enlazan: GitHub y Docsify arman distinto el ID.

`npm run docs:preview` levanta solo el sitio en `http://localhost:4310/docs`, sin base de datos ni Redis.

---

## Tests

```bash
npm test             # 4 suites, 30 tests
npx tsc --noEmit
npm run lint
```

Los tests están junto al código (`*.spec.ts`). Hoy cubren solo los pedidos (DTOs, servicio y repositorio SQL, con la base simulada) y el sitio de documentación. El resto del servicio no tiene tests.

`test/app.e2e-spec.ts` es el ejemplo que trae NestJS y no funciona: importa un módulo que no existe. El CI solo compila; no corre tests ni lint.

---

## Limitaciones conocidas

**Las dos sincronizaciones se pisan.** Corren a la misma hora y escriben precio, stock y estado de los mismos productos. El import de MercadoLibre deja todo lo que toca en `inactive`, y el sync de Automeli no lo corrige hasta que ese SKU cambie en Automeli. Ver [Cuando los dos se cruzan](procesos.md#cuando-los-dos-se-cruzan).

**El import de MercadoLibre corre dentro del servicio HTTP.** Compite con los endpoints por recursos, y se programa tres veces en cada horario: solo lo frena el lock.

**"¿Tiene factura?" no descuenta las notas de crédito.** `exists-by-tlqv-code` responde `true` para una venta con su factura anulada. `invoice.api` lo resuelve por su cuenta; cualquier otro servicio que use ese endpoint ve las facturas anuladas como vigentes.

**Varios endpoints de actualización reemplazan en lugar de modificar.** `PATCH /api/mercadolibre/products`, `PATCH /api/publication-jobs/:id` y el registro de issues dejan vacío lo que no se envía. El `PATCH` de issues borra la severidad si no se la manda.

**Tareas del publicador que no avanzan.** Una tarea en `processing` nunca se libera si el proceso que la tomó se corta, y una en `retry` nunca se vuelve a tomar. Además, Madre nunca marca una corrida como iniciada ni terminada: solo como cancelada.

**`GET /api/analytics/categories/children` sin `parentId` responde `500`.** La consulta del resumen usa una tabla que no está en esa consulta.

**La analítica por categoría tiene el vendedor fijo** (`1757836744`), y sus resultados guardados no se vencen solos.

**La Central de Promociones siempre responde que la publicación existe** en `exists/bulk`, sin mirar la lista.

**Las ventas con aporte de MercadoLibre arrancan el 1 de mayo de 2026**, fijo en el código.

**Una conexión a MySQL por módulo.** `TypeOrmModule.forRoot` está repetido en cada módulo, y cada uno abre su propio grupo de conexiones contra la misma base.

**`updated_at` puede no cambiar en las actualizaciones del sync de Automeli.** La actualización por lotes compara el valor nuevo con el actual después de haberlo asignado. Si la columna no se actualiza sola en la base, la fecha queda igual. No está verificado contra la base.

**Swagger no siempre coincide con el código.** Varios `POST` figuran con `200` y responden `201`. Algunos ejemplos de respuesta no corresponden a lo que se devuelve, por ejemplo en `/api/brands/madre` y `/api/internal/sync-states`. Ante una diferencia, vale [esta referencia](api.md).

**Código sin uso.** El módulo `app/module/madre/delta`, `Cache.module.ts`, `CacheManager.ts`, `InMemoryCacheManager.ts`, `Logger.ts` y las dependencias de Google, `cache-manager` y `p-limit` no se usan.
