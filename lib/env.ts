// Central place for configuration. Every value comes from Vercel's
// Environment Variables (Project > Settings > Environment Variables).
// WHY one file: so you can see at a glance what the app needs, and so
// "is Google Ads connected?" is answered the same way everywhere.

export const env = {
  authSecret: process.env.AUTH_SECRET || '',
  // JSON list of team logins: [{"email":"...","name":"...","passwordHash":"..."}]
  // Make a hash with:  npm run hash-password -- "your password"
  teamUsers: process.env.TEAM_USERS || '',

  ads: {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
    apiVersion: process.env.GOOGLE_ADS_API_VERSION || 'v25',
    // When true, every change is checked by Google but not applied.
    validateOnly: (process.env.ADS_VALIDATE_ONLY ?? 'true') !== 'false',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  },

  n8n: {
    // e.g. https://n8n.yourdomain.com/webhook
    webhookBase: process.env.N8N_WEBHOOK_BASE || '',
    secret: process.env.N8N_WEBHOOK_SECRET || '',
  },

  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
  },
};

/** Google Ads is live only when every credential is present. Otherwise demo data. */
export const adsConfigured = () =>
  Boolean(env.ads.developerToken && env.ads.clientId && env.ads.clientSecret && env.ads.refreshToken);

export const agentConfigured = () => Boolean(env.anthropic.apiKey);
export const n8nConfigured = () => Boolean(env.n8n.webhookBase);
export const storeConfigured = () => Boolean(env.redis.url && env.redis.token);
