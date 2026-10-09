# SENsato - Cloudflare Worker (Telegram Scraper API)

## Descripción

Cloudflare Worker que replica exactamente la obtención de mensajes del canal de Telegram que hace la app Android SENsato (Kotlin + Jsoup en `TelegramChannelParser`), para que la app consuma los posts vía API en vez de scrapear t.me directamente.

## Alcance estricto

El Worker **SOLO** obtiene y sirve posts. NO implementa detección de circuitos ni notificaciones; eso sigue en la app Android.

## Arquitectura

```
t.me/s/EmpresaElectricaDeLaHabana
         │
         ▼
   ┌─────────────┐
   │ CF Worker    │ ← Cron cada 2 min
   │ (Scraper +   │
   │  API HTTP)   │
   └──────┬───────┘
          │
    ┌─────┴─────┐
    ▼           ▼
  ┌────┐     ┌────┐
  │ D1 │     │ KV │
  │posts│    │water│
  └────┘     └────┘
          │
          ▼
   App Android
   GET /api/posts
```

## Endpoints API

### GET /api/posts

```
GET /api/posts?since=<id>&limit=<n>
```

| Parámetro | Tipo    | Default | Descripción                          |
|-----------|---------|---------|--------------------------------------|
| since     | integer | 0       | ID del último post conocido          |
| limit     | integer | 100     | Máx. resultados (máximo 500)         |

**Respuesta:**
```json
[
  {
    "id": 12345,
    "text": "Aviso de interrupción...",
    "timestamp": 1700000000,
    "url": "https://t.me/EmpresaElectricaDeLaHabana/12345"
  }
]
```

### GET /api/health

```json
{
  "ok": true,
  "lastFetch": 1700000000000,
  "lastPostId": 12345,
  "totalPosts": 342
}
```

## Lógica del Scraper (Cron)

1. **Descarga** la primera página con User-Agent de Chrome (timeout 15s)
2. **Parsea** con HTMLRewriter (replica reglas de Jsoup):
   - `data-post` del `.tgme_widget_message` → id
   - `.tgme_widget_message_text` → texto (br→\n, decode entities, nbsp→space, trim)
   - `<time datetime>` → timestamp ISO 8601
   - URL: `https://t.me/EmpresaElectricaDeLaHabana/<id>`
3. **Paginación** hacia atrás con `?before=<id_más_antiguo>`:
   - Mientras el post más antiguo tenga id > watermark
   - Máximo 5 páginas por ejecución
   - 1 segundo de espera entre requests
4. **Backoff ante 429**: 2s, 4s, 8s (máx 3 reintentos)
   - Si sigue fallando: aborta SIN avanzar watermark
5. **Inserta en D1** solo posts con id > watermark (INSERT OR IGNORE)
6. **Actualiza watermark** en KV al id máximo visto
7. **Limpieza** (cada 24h): elimina posts de más de 30 días

## Despliegue

```bash
# Instalar dependencias del worker
cd worker
npm install

# Crear D1
npx wrangler d1 create sensato-eeh-posts

# Crear KV
npx wrangler kv:namespace create KV

# Ejecutar schema
npx wrangler d1 execute sensato-eeh-posts --file=schema.sql

# Actualizar IDs en wrangler.toml

# Deploy
npx wrangler deploy
```

## Integración Android

```kotlin
// Solo cambiar TelegramChannelParser
// El detector de circuitos, notificaciones y UI no se tocan

class TelegramChannelParser {
    private val baseUrl = "https://sensato-eeh-scraper.workers.dev"
    
    fun fetchNewPosts(sinceId: Int): List<Post> {
        val url = "$baseUrl/api/posts?since=$sinceId&limit=100"
        // ... GET y parseo JSON
    }
}
```

## Archivos

```
worker/
├── src/
│   └── index.ts      # Worker principal (scraper + API)
├── wrangler.toml      # Configuración (cron, bindings)
├── schema.sql         # Esquema D1
├── package.json
└── tsconfig.json
```
