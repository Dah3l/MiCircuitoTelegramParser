import { useState } from "react";
import {
  Zap,
  Database,
  Clock,
  Code,
  Server,
  ArrowRight,
  Copy,
  Check,
  Cloud,
  RefreshCw,
  Shield,
  FileText,
} from "lucide-react";

function App() {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  const copyToClipboard = (text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(blockId);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50 bg-slate-900/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SENsato Worker</h1>
              <p className="text-xs text-slate-400">
                Cloudflare Worker · Telegram Scraper API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
              v1.0.0
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            Telegram → API en el Edge
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Un Cloudflare Worker que scrapea el canal de la Empresa Eléctrica de
            La Habana cada 2 minutos y sirve los posts vía API REST. La app
            Android consume esta API en vez de hacer scraping directo.
          </p>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-8 mb-12">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400" />
            Arquitectura
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <ArchBox
              icon={<Globe className="w-8 h-8" />}
              title="t.me/s/..."
              subtitle="Canal público"
              color="blue"
            />
            <ArrowRight className="w-6 h-6 text-slate-500 rotate-90 md:rotate-0" />
            <ArchBox
              icon={<Cloud className="w-8 h-8" />}
              title="CF Worker"
              subtitle="Cron cada 2 min"
              color="amber"
            />
            <ArrowRight className="w-6 h-6 text-slate-500 rotate-90 md:rotate-0" />
            <div className="flex flex-col gap-3">
              <ArchBox
                icon={<Database className="w-6 h-6" />}
                title="D1"
                subtitle="Posts"
                color="emerald"
                small
              />
              <ArchBox
                icon={<Clock className="w-6 h-6" />}
                title="KV"
                subtitle="Watermark"
                color="purple"
                small
              />
            </div>
            <ArrowRight className="w-6 h-6 text-slate-500 rotate-90 md:rotate-0" />
            <ArchBox
              icon={<Smartphone className="w-8 h-8" />}
              title="App Android"
              subtitle="GET /api/posts"
              color="rose"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <FeatureCard
            icon={<RefreshCw className="w-6 h-6" />}
            title="Cron cada 2 min"
            description="Scrapea el canal automáticamente. Paginación hacia atrás para no perder posts. Backoff inteligente ante 429."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Watermark en KV"
            description="Rastrea el último post visto. Si detecta huecos, va hacia atrás. Primera ejecución como semilla."
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Limpieza automática"
            description="Elimina posts de más de 30 días. Se ejecuta cada 24h para mantener la BD ligera."
          />
        </div>
      </section>

      {/* API Documentation */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <Code className="w-6 h-6 text-amber-400" />
          API Endpoints
        </h2>

        {/* GET /api/posts */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              GET
            </span>
            <code className="text-lg font-mono text-white">/api/posts</code>
          </div>
          <p className="text-slate-300 mb-4">
            Devuelve posts con <code className="text-amber-300">id &gt; since</code>, ordenados de más antiguo a más reciente.
          </p>

          <div className="bg-slate-900/80 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide">
                Parámetros
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="pb-2 pr-4">Parámetro</th>
                  <th className="pb-2 pr-4">Tipo</th>
                  <th className="pb-2 pr-4">Default</th>
                  <th className="pb-2">Descripción</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr>
                  <td className="py-2 pr-4 font-mono text-amber-300">since</td>
                  <td className="py-2 pr-4">integer</td>
                  <td className="py-2 pr-4">0</td>
                  <td className="py-2">ID del último post conocido</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-amber-300">limit</td>
                  <td className="py-2 pr-4">integer</td>
                  <td className="py-2 pr-4">100</td>
                  <td className="py-2">Máx. resultados (máx 500)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CodeBlock
            id="response-posts"
            label="Respuesta"
            code={`[
  {
    "id": 12345,
    "text": "Aviso de interrupción eléctrica\\nÁrea: Centro Habana\\nHorario: 8:00 AM - 2:00 PM",
    "timestamp": 1700000000,
    "url": "https://t.me/EmpresaElectricaDeLaHabana/12345"
  },
  ...
]`}
            onCopy={copyToClipboard}
            copied={copiedBlock}
          />
        </div>

        {/* GET /api/health */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              GET
            </span>
            <code className="text-lg font-mono text-white">/api/health</code>
          </div>
          <p className="text-slate-300 mb-4">
            Estado del sistema: último fetch, último post ID, total de posts.
          </p>

          <CodeBlock
            id="response-health"
            label="Respuesta"
            code={`{
  "ok": true,
  "lastFetch": 1700000000000,
  "lastPostId": 12345,
  "totalPosts": 342
}`}
            onCopy={copyToClipboard}
            copied={copiedBlock}
          />
        </div>
      </section>

      {/* Android Integration */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-amber-400" />
          Integración Android
        </h2>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-6">
          <p className="text-slate-300 mb-4">
            La app Android solo necesita cambiar el{" "}
            <code className="text-amber-300">TelegramChannelParser</code> para
            consumir la API en vez de scrapear t.me directamente. El detector de
            circuitos, notificaciones y UI no se tocan.
          </p>

          <CodeBlock
            id="android-kotlin"
            label="Kotlin - Nuevo Parser"
            code={`// TelegramChannelParser.kt (nueva versión)
class TelegramChannelParser {
    private val baseUrl = "https://sensato-eeh-scraper.workers.dev"
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
    private val gson = Gson()

    data class Post(
        val id: Int,
        val text: String,
        val timestamp: Long,
        val url: String
    )

    fun fetchNewPosts(sinceId: Int): List<Post> {
        val url = "$baseUrl/api/posts?since=$sinceId&limit=100"
        val request = Request.Builder().url(url).build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return emptyList()
            val json = response.body?.string() ?: return emptyList()
            val type = object : TypeToken<List<Post>>() {}.type
            return gson.fromJson(json, type) ?: emptyList()
        }
    }
}`}
            onCopy={copyToClipboard}
            copied={copiedBlock}
          />
        </div>
      </section>

      {/* Worker Configuration */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <Cloud className="w-6 h-6 text-amber-400" />
          Configuración del Worker
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold mb-4">wrangler.toml</h3>
            <CodeBlock
              id="wrangler"
              label=""
              code={`name = "sensato-eeh-scraper"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/2 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "sensato-eeh-posts"
database_id = "TU_DATABASE_ID"

[[kv_namespaces]]
binding = "KV"
namespace_id = "TU_KV_NAMESPACE_ID"`}
              onCopy={copyToClipboard}
              copied={copiedBlock}
            />
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold mb-4">schema.sql (D1)</h3>
            <CodeBlock
              id="schema"
              label=""
              code={`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    url TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_timestamp
    ON posts(timestamp);

CREATE INDEX IF NOT EXISTS idx_posts_id
    ON posts(id);`}
              onCopy={copyToClipboard}
              copied={copiedBlock}
            />
          </div>
        </div>
      </section>

      {/* Deployment */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-400" />
          Despliegue
        </h2>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
          <CodeBlock
            id="deploy"
            label="Comandos de despliegue"
            code={`# 1. Crear base de datos D1
npx wrangler d1 create sensato-eeh-posts

# 2. Crear namespace KV
npx wrangler kv:namespace create KV

# 3. Ejecutar schema SQL
npx wrangler d1 execute sensato-eeh-posts --file=schema.sql

# 4. Actualizar wrangler.toml con los IDs

# 5. Deploy
npx wrangler deploy

# 6. (Opcional) Ejecutar el cron manualmente para probar
npx wrangler trigger "sensato-eeh-scraper"`}
            onCopy={copyToClipboard}
            copied={copiedBlock}
          />
        </div>
      </section>

      {/* Scraper Logic */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-amber-400" />
          Lógica del Scraper
        </h2>

        <div className="space-y-4">
          <StepCard
            step={1}
            title="Descarga la primera página"
            description="GET a https://t.me/s/EmpresaElectricaDeLaHabana con el User-Agent de Chrome. Timeout 15s."
          />
          <StepCard
            step={2}
            title="Parsea con HTMLRewriter"
            description="Extrae data-post, texto (br→\\n, decode entities, nbsp→space, trim), timestamp del <time datetime>, y construye la URL."
          />
          <StepCard
            step={3}
            title="Paginación hacia atrás"
            description="Si el post más antiguo tiene id > watermark, pide la siguiente página con ?before=<id_más_antiguo>. Máx 5 páginas, 1s entre requests."
          />
          <StepCard
            step={4}
            title="Backoff ante 429"
            description="Si Telegram responde 429: espera 2s, 4s, 8s (máx 3 reintentos). Si sigue fallando, aborta SIN avanzar el watermark."
          />
          <StepCard
            step={5}
            title="Inserta en D1"
            description="Solo posts con id > watermark. INSERT OR IGNORE para evitar duplicados. Actualiza watermark al id máximo visto."
          />
          <StepCard
            step={6}
            title="Limpieza (cada 24h)"
            description="Elimina posts con timestamp de más de 30 días. Se ejecuta solo si pasaron >24h desde la última limpieza."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>SENsato Worker · Cloudflare Workers + D1 + KV</p>
          <p className="mt-1">
            Canal: EmpresaElectricaDeLaHabana · Alcance: solo scraping y API
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function ArchBox({
  icon,
  title,
  subtitle,
  color,
  small = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  small?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
    amber:
      "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400",
    emerald:
      "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400",
    purple:
      "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400",
    rose: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400",
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4 ${small ? "min-w-[120px]" : "min-w-[160px]"} text-center`}
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="font-semibold text-sm text-white">{title}</div>
      <div className="text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 hover:border-amber-500/30 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function CodeBlock({
  id,
  label,
  code,
  onCopy,
  copied,
}: {
  id: string;
  label: string;
  code: string;
  onCopy: (text: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="relative">
      {label && (
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          {label}
        </div>
      )}
      <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700/50">
        <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap">
          {code}
        </pre>
      </div>
      <button
        onClick={() => onCopy(code, id)}
        className="absolute top-8 right-3 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors text-slate-400 hover:text-white"
        title="Copiar"
      >
        {copied === id ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 bg-slate-800/30 rounded-xl border border-slate-700/30 p-5">
      <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
        {step}
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

// Iconos SVG inline para el diagrama de arquitectura
function Globe({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 014 9 15 15 0 01-4 9 15 15 0 01-4-9 15 15 0 014-9z"
      />
    </svg>
  );
}

function Smartphone({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
      />
    </svg>
  );
}

export default App;
