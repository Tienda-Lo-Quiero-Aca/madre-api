# Operación

Cómo se despliega, cómo verificar que quedó bien, y qué hacer ante los problemas más frecuentes.

← [Volver al inicio](../README.md)

**Contenido**

1. [Dónde corre](#dónde-corre)
2. [Deploy](#deploy)
3. [Verificar que está sano](#verificar-que-está-sano)
4. [Problemas frecuentes](#problemas-frecuentes)

---

## Dónde corre

| | |
|---|---|
| Servidor | Droplet de DigitalOcean |
| Directorio | El que indica el secret `DEPLOY_PATH` del repositorio en GitHub |
| Servicio HTTP | PM2, con el nombre `madre-api`, ejecutando `dist/main.js` |
| Worker | `dist/worker.js`. **El deploy no lo maneja**: ver abajo. |
| Configuración | `.env` en el directorio del servicio |
| Base de datos y Redis | Externos. Los datos de conexión están en el `.env`. |

Dos detalles que evitan confusiones:

- **PM2 ejecuta el código compilado** (`dist/`), no el fuente.
- **El servicio lee el `.env` y la documentación del directorio desde el que arrancó.** PM2 tiene que lanzarlo desde la raíz del repositorio.

### El worker

El sync de Automeli corre en un proceso aparte, `dist/worker.js`, y **el deploy automático no lo arranca ni lo reinicia**. Para saber si está corriendo:

```bash
pm2 list
```

- Si hay un proceso que ejecuta `dist/worker.js`, después de cada deploy hay que reiniciarlo a mano. Si no, sigue corriendo el código anterior.
- Si no hay ninguno, el sync de Automeli **no está corriendo**. Para crearlo (el nombre es una sugerencia):

```bash
cd "$DEPLOY_PATH" && pm2 start dist/worker.js --name madre-worker && pm2 save
```

---

## Deploy

**Es automático.** Cada push a `main` dispara el workflow `Deploy to Production` de GitHub Actions, que entra por SSH al servidor y corre:

```bash
cd $DEPLOY_PATH
git pull origin main
npm ci
npm run build
pm2 restart madre-api || pm2 start dist/main.js --name madre-api
pm2 save
```

El avance se ve en la pestaña **Actions** del repositorio. Usa cuatro secrets: `DEPLOY_KEY`, `DEPLOY_USER`, `DEPLOY_HOST` y `DEPLOY_PATH`.

**El build corre en el servidor de producción.** `npm run build` borra `dist/` antes de compilar. Si la compilación falla, el proceso que está corriendo sigue vivo con el código anterior en memoria, pero un reinicio lo dejaría sin nada que ejecutar. Ante un deploy fallido, no reiniciar hasta tener un build bueno.

**Si el cambio es solo de documentación** (`README.md` o `docs/*.md`), alcanza con el `git pull`: el sitio en `/docs` lee los textos en cada visita.

### Deploy a mano

Si hay que desplegar sin pasar por GitHub Actions, con un respaldo por si falla el build:

```bash
cd "$DEPLOY_PATH" && git pull origin main && npm ci && cp -r dist dist.backup && npm run build && ls -l dist/main.js
```

El `ls` del final tiene que mostrar el archivo con la fecha y hora de ahora. Recién entonces:

```bash
pm2 restart madre-api --update-env && rm -rf dist.backup
```

Si el build falló:

```bash
rm -rf dist && mv dist.backup dist && pm2 restart madre-api
```

**`--update-env`** hace que PM2 relea el `.env`. Sin eso, sigue con las variables que tenía cargadas. Hace falta, por ejemplo, después de cargar `DOCS_SITE_USER` y `DOCS_SITE_PASSWORD`.

---

## Verificar que está sano

**El proceso está arriba y reinició hace poco**

```bash
pm2 list
```

La columna `uptime` del proceso `madre-api` tiene que mostrar segundos o minutos después de un deploy.

**Arrancó sin errores**

```bash
pm2 logs madre-api --lines 60 --nostream
```

Tiene que aparecer `API running on port …`. Si `PORT` no está definido, el mensaje dice 3001 pero el servicio escucha en 3000.

**Responde**

```bash
curl -s -X POST "https://api.madre.loquieroaca.com/api/products/madre/status/bulk" \
  -H "Content-Type: application/json" -d '{"skus":["B0953HLGJ3"]}'
```

**Las sincronizaciones del catálogo corrieron**

Corren a las 00, 06, 12 y 18 h. Después de cada horario, en los logs del servicio:

```bash
pm2 logs madre-api --lines 400 --nostream | grep -E "MeliProductsImport|MELI PRODUCTS IMPORT COMPLETED" | tail -5
```

Y en los del worker:

```bash
pm2 logs madre-worker --lines 400 --nostream | grep -E "AutomeliSync|AUTOMELI SYNC COMPLETED" | tail -5
```

| Mensaje | Significa |
|---|---|
| `Cron triggered at …` | Arrancó la corrida programada. |
| `Another … is already running. Skipping.` | Ya había una corrida en curso. En el import de MercadoLibre es normal verlo dos veces por horario. |
| `AUTOMELI SYNC COMPLETED` · `MELI PRODUCTS IMPORT COMPLETED` | Terminó, con un resumen de lo procesado. |
| `Failed to fetch products after retries, stopping sync` | Automeli no respondió y la corrida cortó a mitad. |
| `Sync failed` · `Import failed` | La corrida falló. El error sigue en la misma línea. |

**La documentación**

`https://api.madre.loquieroaca.com/docs` tiene que mostrar el menú con todas las secciones. Si pide usuario y clave, son los de `DOCS_SITE_USER` y `DOCS_SITE_PASSWORD`.

---

## Problemas frecuentes

### Subí un cambio y se sigue comportando igual

1. Revisar en **Actions** que el deploy haya terminado bien. Si falló el build, el servicio sigue con el código anterior.
2. Verificar con `pm2 list` que el `uptime` sea reciente.
3. Si el cambio era del sync de Automeli, recordar que el worker **no** se reinicia con el deploy: ver [el worker](#el-worker).

### El servicio no arranca

En `pm2 logs madre-api --err`:

| Error | Causa |
|---|---|
| `[REDIS_CLIENT] Missing REDIS_HOST/REDIS_PORT.` | Faltan las variables de Redis en el `.env`. |
| Errores de conexión a MySQL | Revisar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` y `DB_NAME`. |
| Errores de conexión a Redis | El servicio siempre usa TLS: el Redis tiene que aceptarlo. |

### Un producto quedó `inactive` y debería estar activo

Lo más probable es que lo haya tocado el import de MercadoLibre, que deja todo lo que actualiza en `inactive`. Ver [Cuando los dos se cruzan](procesos.md#cuando-los-dos-se-cruzan).

El sync de Automeli lo corrige solo cuando el SKU cambia en Automeli. Para forzarlo, borrar la huella del SKU y correr el sync:

```bash
redis-cli --tls -h "$REDIS_HOST" -p "$REDIS_PORT" --user "$REDIS_USERNAME" --pass "$REDIS_PASSWORD" HDEL automeli_products_state B0953HLGJ3
```

```bash
cd "$DEPLOY_PATH" && npm run sync:once
```

Para que lo reescriba en el próximo horario, alcanza con borrar la huella.

### Forzar que una sincronización reescriba todo

Borrar el hash de huellas. La próxima corrida trata a todos los SKUs como cambiados:

```bash
redis-cli --tls -h "$REDIS_HOST" -p "$REDIS_PORT" --user "$REDIS_USERNAME" --pass "$REDIS_PASSWORD" DEL automeli_products_state
```

Para el import de MercadoLibre, la clave es `meli_products_import_state`. Una corrida completa del import pide la descripción y la categoría de **cada** publicación a mercadolibre-api: tarda bastante más que una normal.

### Una sincronización no corre y dice que hay otra en curso

Si un proceso murió a mitad de una corrida, el lock queda hasta 4 horas. Confirmar que no haya una corrida en marcha mirando los logs y, si no la hay, borrarlo:

```bash
redis-cli --tls -h "$REDIS_HOST" -p "$REDIS_PORT" --user "$REDIS_USERNAME" --pass "$REDIS_PASSWORD" DEL automeli_sync:running
```

El del import de MercadoLibre es `meli_products_import:running`.

### Faltan pesos en el catálogo

```bash
cd "$DEPLOY_PATH" && npm run sync:weights:once
```

Busca los productos sin peso y se los carga desde Automeli. No corre si el sync de Automeli está en curso.

### Tareas del publicador trabadas en `processing`

Si el proceso que publicaba se cortó, sus tareas quedan en `processing` para siempre. Para devolver a `pending` las que llevan más de una hora tomadas, en la base:

```sql
UPDATE publication_jobs
SET status = 'pending', locked_at = NULL, updated_at = NOW()
WHERE status = 'processing' AND locked_at < NOW() - INTERVAL 1 HOUR;
```

Las tareas en `retry` tampoco se vuelven a tomar. Si hay que reintentarlas, el mismo `UPDATE` con `status = 'retry'`.

### La analítica por categoría muestra números viejos

Los resultados se guardan hasta que alguien los invalida:

```bash
curl -s -X POST "https://api.madre.loquieroaca.com/api/analytics/categories/invalidate"
```

La siguiente consulta de cada pantalla tarda más, porque recalcula.

### Proteger la documentación con usuario y clave

En el `.env` del servidor:

```
DOCS_SITE_USER=...
DOCS_SITE_PASSWORD=...
```

Y reiniciar con `pm2 restart madre-api --update-env`. Desde ese momento el sitio pide credenciales y publica también esta página.
