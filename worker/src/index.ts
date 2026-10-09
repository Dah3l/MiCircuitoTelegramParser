/**
 * ============================================================
 * SENsato - Cloudflare Worker
 * Scraper del canal de Telegram: EmpresaElectricaDeLaHabana
 * ============================================================
 *
 * Este Worker replica el comportamiento del parser de la app Android
 * (TelegramChannelParser con Jsoup), pero ejecutándose en el edge.
 *
 * Funcionalidades:
 * 1. Cron Trigger cada 2 min → scrapea el canal, guarda en D1
 * 2. API HTTP → sirve posts a la app Android
 *
 * Alcance estricto: SOLO obtiene y sirve posts.
 * La detección de circuitos y notificaciones siguen en la app.
 * ============================================================
 */

// ============================================================
// Tipos y constantes
// ============================================================

/** Bindings definidos en wrangler.toml */
interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

/** Estructura de un post parseado del canal */
interface ParsedPost {
  id: number;
  text: string;
  timestamp: number; // epoch seconds
  url: string;
}

/** Constantes del scraper */
const CHANNEL_URL = "https://t.me/s/EmpresaElectricaDeLaHabana";
const CHANNEL_NAME = "EmpresaElectricaDeLaHabana";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 15000;
const MAX_PAGES_PER_RUN = 5;
const DELAY_BETWEEN_REQUESTS_MS = 1000;
const MAX_RETRIES_429 = 3;
const KV_WATERMARK_KEY = "eeh_last_seen_id";
const KV_LAST_FETCH_KEY = "eeh_last_fetch";
const KV_LAST_CLEANUP_KEY = "eeh_last_cleanup";
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas
const POST_MAX_AGE_DAYS = 30;

// ============================================================
// Parser HTML con HTMLRewriter
// ============================================================

/**
 * Clase auxiliar para extraer posts usando HTMLRewriter.
 * Replica exactamente las reglas de extracción del parser Jsoup:
 * - Selector: div.tgme_widget_message_wrap
 * - ID: atributo data-post del nodo interno .tgme_widget_message
 * - Texto: .tgme_widget_message_text (br → \n, decode entities, nbsp → space, trim)
 * - Timestamp: atributo datetime del <time> (ISO 8601)
 * - URL: https://t.me/EmpresaElectricaDeLaHabana/<id>
 */
class MessageParser {
  private posts: ParsedPost[] = [];
  private currentWrap = false;
  private currentMessageDataPost = "";
  private currentText = "";
  private currentTimestamp = "";
  private insideText = false;
  private textChunks: string[] = [];

  /**
   * Procesa el HTML completo y devuelve los posts parseados.
   * HTMLRewriter es streaming, así que acumulamos fragmentos.
   */
  async parse(html: string): Promise<ParsedPost[]> {
    this.posts = [];

    // Usamos HTMLRewriter para parsear el HTML de forma eficiente
    const rewriter = new HTMLRewriter()
      // Detectamos cada wrap de mensaje
      .on("div.tgme_widget_message_wrap", {
        element: () => {
          this.currentWrap = true;
          this.currentMessageDataPost = "";
          this.currentText = "";
          this.currentTimestamp = "";
          this.textChunks = [];
        },
        text: () => {
          // No necesitamos texto del wrap en sí
        },
      })
      // Capturamos el data-post del mensaje interno
      .on(".tgme_widget_message", {
        element: (el) => {
          if (this.currentWrap) {
            this.currentMessageDataPost = el.getAttribute("data-post") || "";
          }
        },
      })
      // Capturamos el texto del mensaje
      .on(".tgme_widget_message_text", {
        element: () => {
          this.insideText = true;
          this.textChunks = [];
        },
        text: (text) => {
          if (this.insideText) {
            this.textChunks.push(text.text);
          }
        },
      })
      // Convertimos <br> en saltos de línea dentro del texto
      .on(".tgme_widget_message_text br", {
        element: () => {
          if (this.insideText) {
            this.textChunks.push("\n");
          }
        },
      })
      // Al cerrar el contenedor de texto, lo marcamos
      .on(".tgme_widget_message_text", {
        element: () => {},
      })
      // Capturamos el timestamp del <time>
      .on(".tgme_widget_message_date time", {
        element: (el) => {
          if (this.currentWrap) {
            this.currentTimestamp = el.getAttribute("datetime") || "";
          }
        },
      });

    // Procesamos el HTML
    const response = new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const rewritten = rewriter.transform(response);
    await rewritten.text();

    // Como HTMLRewriter es streaming y no tiene un "end" hook directo
    // en los elementos wrap, usamos un enfoque alternativo:
    // parseamos con regex sobre el HTML original para mayor fiabilidad
    return this.parseWithRegex(html);
  }

  /**
   * Parser alternativo con regex que replica exactamente las reglas de Jsoup.
   * Más robusto para el caso de Telegram que tiene HTML predecible.
   */
  private parseWithRegex(html: string): ParsedPost[] {
    const posts: ParsedPost[] = [];

    // Buscamos cada bloque de mensaje
    // El HTML de t.me/s/ tiene divs con clase tgme_widget_message_wrap
    const wrapRegex =
      /<div[^>]*class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*tgme_widget_message_wrap[^"]*"|<\/section>)/g;

    let wrapMatch;
    while ((wrapMatch = wrapRegex.exec(html)) !== null) {
      const wrapContent = wrapMatch[1];
      const post = this.extractPost(wrapContent);
      if (post) {
        posts.push(post);
      }
    }

    return posts;
  }

  /**
   * Extrae un post individual del contenido de un wrap.
   */
  private extractPost(wrapContent: string): ParsedPost | null {
    // 1. Extraer data-post del .tgme_widget_message
    const dataPostMatch = wrapContent.match(
      /<div[^>]*class="[^"]*tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"/
    );
    if (!dataPostMatch) return null;

    const dataPost = dataPostMatch[1]; // formato: "EmpresaElectricaDeLaHabana/<id>"
    const idStr = dataPost.split("/")[1];
    if (!idStr) return null;

    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) return null;

    // 2. Extraer texto de .tgme_widget_message_text
    const textMatch = wrapContent.match(
      /<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    let text = "";
    if (textMatch) {
      text = this.cleanHtmlText(textMatch[1]);
    }

    // Descartar posts sin texto
    if (!text || text.trim().length === 0) return null;

    // 3. Extraer timestamp del <time datetime="...">
    const timeMatch = wrapContent.match(
      /<time[^>]*datetime="([^"]+)"/
    );
    let timestamp: number;
    if (timeMatch) {
      const parsed = Date.parse(timeMatch[1]);
      timestamp = isNaN(parsed)
        ? Math.floor(Date.now() / 1000)
        : Math.floor(parsed / 1000);
    } else {
      // Si falta, usar hora actual
      timestamp = Math.floor(Date.now() / 1000);
    }

    // 4. Construir URL
    const url = `https://t.me/${CHANNEL_NAME}/${id}`;

    return { id, text, timestamp, url };
  }

  /**
   * Limpia el texto HTML:
   * - Convierte <br> y <br/> en \n
   * - Decodifica entidades HTML
   * - Reemplaza &nbsp; (\u00A0) por espacio
   * - Elimina tags restantes
   * - Hace trim
   */
  private cleanHtmlText(html: string): string {
    let text = html;

    // Convertir <br>, <br/>, <br /> en saltos de línea
    text = text.replace(/<br\s*\/?>/gi, "\n");

    // Eliminar tags HTML restantes
    text = text.replace(/<[^>]+>/g, "");

    // Decodificar entidades HTML comunes
    text = this.decodeHtmlEntities(text);

    // Reemplazar \u00A0 (nbsp) por espacio normal
    text = text.replace(/\u00A0/g, " ");

    // Trim
    text = text.trim();

    return text;
  }

  /**
   * Decodifica entidades HTML.
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
      "&nbsp;": " ",
      "&#x27;": "'",
      "&#x2F;": "/",
      "&#47;": "/",
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.split(entity).join(char);
    }

    // Decodificar entidades numéricas (&#123; o &#x1F;)
    result = result.replace(/&#(\d+);/g, (_, num) =>
      String.fromCharCode(parseInt(num, 10))
    );
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    return result;
  }
}

// ============================================================
// Scraper: descarga y parseo con paginación
// ============================================================

/**
 * Descarga una página del canal con el User-Agent correcto y timeout.
 * Implementa backoff para 429 (Too Many Requests).
 */
async function fetchChannelPage(
  url: string,
  retries: number = 0
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      // Backoff exponencial: 2s, 4s, 8s
      if (retries >= MAX_RETRIES_429) {
        console.error(
          `[Scraper] 429 después de ${MAX_RETRIES_429} reintentos, abortando`
        );
        return null;
      }
      const backoffMs = Math.pow(2, retries + 1) * 1000; // 2s, 4s, 8s
      console.warn(
        `[Scraper] 429 recibido, esperando ${backoffMs}ms (intento ${retries + 1}/${MAX_RETRIES_429})`
      );
      await sleep(backoffMs);
      return fetchChannelPage(url, retries + 1);
    }

    if (!response.ok) {
      console.error(`[Scraper] Error HTTP ${response.status} para ${url}`);
      return null;
    }

    return await response.text();
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[Scraper] Error de red: ${err}`);
    return null;
  }
}

/**
 * Ejecución principal del cron: scrapea el canal con paginación.
 */
async function runScraper(env: Env): Promise<void> {
  console.log("[Scraper] Iniciando ejecución programada...");

  const parser = new MessageParser();

  // Leer watermark actual de KV
  const watermarkStr = await env.KV.get(KV_WATERMARK_KEY);
  const watermark = watermarkStr ? parseInt(watermarkStr, 10) : 0;
  console.log(`[Scraper] Watermark actual: ${watermark || "(sin watermark - primera ejecución)"}`);

  let allPosts: ParsedPost[] = [];
  let currentUrl = CHANNEL_URL;
  let abortDueTo429 = false;

  // Paginación: hasta MAX_PAGES_PER_RUN páginas
  for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
    console.log(`[Scraper] Descargando página ${page + 1}: ${currentUrl}`);

    const html = await fetchChannelPage(currentUrl);
    if (html === null) {
      // Error (posiblemente 429 agotado) → abortar SIN avanzar watermark
      console.error("[Scraper] Abortando por error en fetch");
      abortDueTo429 = true;
      break;
    }

    const pagePosts = await parser.parse(html);
    if (pagePosts.length === 0) {
      console.log("[Scraper] No se encontraron posts en esta página, detenemos paginación");
      break;
    }

    allPosts = allPosts.concat(pagePosts);
    console.log(`[Scraper] Página ${page + 1}: ${pagePosts.length} posts encontrados`);

    // Determinar el post más antiguo de esta página
    const oldestPost = pagePosts.reduce((min, p) => (p.id < min.id ? p : min), pagePosts[0]);

    // Condición de parada: si el más antiguo ya está por debajo del watermark, no seguimos
    if (watermark > 0 && oldestPost.id <= watermark) {
      console.log(`[Scraper] Post más antiguo (${oldestPost.id}) <= watermark (${watermark}), detenemos`);
      break;
    }

    // Preparar URL de la siguiente página con ?before=<id_más_antiguo>
    currentUrl = `${CHANNEL_URL}?before=${oldestPost.id}`;

    // Espera entre requests (excepto en la última iteración)
    if (page < MAX_PAGES_PER_RUN - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  if (abortDueTo429 && allPosts.length === 0) {
    console.error("[Scraper] Abortado sin datos. Watermark NO avanzado.");
    return;
  }

  // Filtrar solo posts nuevos (id > watermark)
  const newPosts = watermark > 0 ? allPosts.filter((p) => p.id > watermark) : allPosts;

  if (newPosts.length === 0) {
    console.log("[Scraper] No hay posts nuevos que insertar");
    return;
  }

  // Ordenar de más antiguo a más reciente
  newPosts.sort((a, b) => a.id - b.id);

  console.log(`[Scraper] Insertando ${newPosts.length} posts nuevos en D1...`);

  // Insertar en D1 (batch)
  const fetchedAt = Math.floor(Date.now() / 1000);
  const stmts = newPosts.map(
    (post) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO posts (id, text, timestamp, url, fetched_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(post.id, post.text, post.timestamp, post.url, fetchedAt)
  );

  // D1 batch tiene límite, procesamos en lotes de 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const batch = stmts.slice(i, i + BATCH_SIZE);
    await env.DB.batch(batch);
  }

  // Actualizar watermark al id máximo visto
  const maxId = Math.max(...allPosts.map((p) => p.id));
  await env.KV.put(KV_WATERMARK_KEY, maxId.toString());
  await env.KV.put(KV_LAST_FETCH_KEY, Date.now().toString());

  console.log(`[Scraper] Completado. Watermark actualizado a ${maxId}. Total posts nuevos: ${newPosts.length}`);

  // ============================================================
  // Limpieza de posts antiguos (más de 30 días)
  // Solo si pasaron >24h desde la última limpieza
  // ============================================================
  await maybeRunCleanup(env);
}

/**
 * Ejecuta la limpieza de posts viejos si corresponde.
 */
async function maybeRunCleanup(env: Env): Promise<void> {
  const lastCleanupStr = await env.KV.get(KV_LAST_CLEANUP_KEY);
  const lastCleanup = lastCleanupStr ? parseInt(lastCleanupStr, 10) : 0;
  const now = Date.now();

  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return; // Aún no toca limpiar
  }

  console.log("[Cleanup] Ejecutando limpieza de posts antiguos...");

  const cutoff = Math.floor(now / 1000) - POST_MAX_AGE_DAYS * 24 * 60 * 60;
  const result = await env.DB.prepare(
    "DELETE FROM posts WHERE timestamp < ?"
  ).bind(cutoff).run();

  console.log(`[Cleanup] Eliminados ${result.meta.changes || 0} posts con más de ${POST_MAX_AGE_DAYS} días`);

  await env.KV.put(KV_LAST_CLEANUP_KEY, now.toString());
}

// ============================================================
// API HTTP: endpoints para la app Android
// ============================================================

/**
 * GET /api/posts?since=<id>&limit=<n>
 * Devuelve posts con id > since, ordenados de más antiguo a más reciente.
 * Límite por defecto: 100, máximo: 500.
 */
async function handleGetPosts(
  env: Env,
  since: string | null,
  limit: string | null
): Promise<Response> {
  const sinceId = since ? parseInt(since, 10) : 0;
  let limitNum = limit ? parseInt(limit, 10) : 100;

  // Validaciones
  if (isNaN(sinceId) || sinceId < 0) {
    return jsonResponse({ error: "Parámetro 'since' inválido" }, 400);
  }
  if (isNaN(limitNum) || limitNum < 1) {
    limitNum = 100;
  }
  if (limitNum > 500) {
    limitNum = 500;
  }

  const result = await env.DB.prepare(
    "SELECT id, text, timestamp, url FROM posts WHERE id > ? ORDER BY id ASC LIMIT ?"
  )
    .bind(sinceId, limitNum)
    .all<{ id: number; text: string; timestamp: number; url: string }>();

  return jsonResponse(result.results);
}

/**
 * GET /api/health
 * Devuelve estado del sistema: último fetch, último post, total.
 */
async function handleHealth(env: Env): Promise<Response> {
  const lastFetchStr = await env.KV.get(KV_LAST_FETCH_KEY);
  const watermarkStr = await env.KV.get(KV_WATERMARK_KEY);

  const totalResult = await env.DB.prepare("SELECT COUNT(*) as count FROM posts").first<{ count: number }>();

  return jsonResponse({
    ok: true,
    lastFetch: lastFetchStr ? parseInt(lastFetchStr, 10) : null,
    lastPostId: watermarkStr ? parseInt(watermarkStr, 10) : null,
    totalPosts: totalResult?.count || 0,
  });
}

// ============================================================
// Utilidades
// ============================================================

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Entry point del Worker
// ============================================================

export default {
  /**
   * Handler de solicitudes HTTP (API).
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Solo aceptamos GET
    if (request.method !== "GET") {
      return jsonResponse({ error: "Método no permitido" }, 405);
    }

    // Routing
    try {
      if (pathname === "/api/posts") {
        const since = url.searchParams.get("since");
        const limit = url.searchParams.get("limit");
        return await handleGetPosts(env, since, limit);
      }

      if (pathname === "/api/health") {
        return await handleHealth(env);
      }

      // Raíz: info básica
      if (pathname === "/" || pathname === "") {
        return jsonResponse({
          service: "SENsato EEH Scraper",
          version: "1.0.0",
          endpoints: {
            "/api/posts?since=<id>&limit=<n>":
              "Obtiene posts con id > since (default 0), máximo 500",
            "/api/health": "Estado del sistema",
          },
        });
      }

      return jsonResponse({ error: "Ruta no encontrada" }, 404);
    } catch (err) {
      console.error(`[API] Error: ${err}`);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  },

  /**
   * Handler de Cron Trigger (cada 2 minutos).
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runScraper(env));
  },
};
