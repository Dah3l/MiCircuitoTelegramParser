-- ============================================================
-- Esquema de base de datos D1 para SENsato
-- Tabla principal de posts del canal de Telegram
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    url TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);

-- Índice para consultas por timestamp (ordenamiento)
CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp);

-- Índice para consultas de paginación por id
CREATE INDEX IF NOT EXISTS idx_posts_id ON posts(id);

-- ============================================================
-- Limpieza de posts antiguos (más de 30 días)
-- Se ejecuta al final del cron si pasaron >24h desde la última
-- ============================================================
-- DELETE FROM posts WHERE timestamp < (strftime('%s', 'now') - 2592000);
-- (2592000 = 30 días en segundos)
