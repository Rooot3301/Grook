import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyOauth2 from '@fastify/oauth2';
import { logger } from '../utils/logger.js';
import { ensureSecret } from '../utils/env.js';

const SESSION_COOKIE = 'grook_session';
const SESSION_TTL    = '7d';

/**
 * Enregistre les plugins d'authentification (cookies + JWT + OAuth2 Discord)
 * et expose deux décorateurs :
 *   - request.session : { userId, username, avatar } si connecté, sinon null
 *   - fastify.requireOwner : preHandler qui rejette si l'utilisateur n'est pas BOT_OWNER_ID
 */
export async function registerAuth(fastify, { publicUrl, ownerId }) {
  const clientId     = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  // JWT secret : auto-généré + persisté dans .env si manquant.
  const jwtSecret = ensureSecret('DASHBOARD_JWT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET requis pour le dashboard — configure les via le portail Discord Developer puis relance.');
  }
  if (!ownerId) {
    throw new Error('BOT_OWNER_ID requis pour le dashboard (accès mono-user) — mets ton ID Discord dans .env.');
  }

  await fastify.register(fastifyCookie);
  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign:   { expiresIn: SESSION_TTL },
  });

  await fastify.register(fastifyOauth2, {
    name: 'discordOAuth2',
    scope: ['identify'],
    credentials: {
      client: { id: clientId, secret: clientSecret },
      auth: fastifyOauth2.DISCORD_CONFIGURATION,
    },
    startRedirectPath: '/auth/login',
    callbackUri: `${publicUrl}/auth/callback`,
    cookie: { secure: publicUrl.startsWith('https://'), sameSite: 'lax' },
  });

  // Décorateur : session courante (null si non connectée)
  fastify.decorateRequest('session', null);
  fastify.addHook('preHandler', async (request) => {
    try {
      const token = await request.jwtVerify({ onlyCookie: true });
      request.session = token;
    } catch {
      request.session = null;
    }
  });

  // Décorateur : garde d'accès owner-only
  fastify.decorate('requireOwner', async (request, reply) => {
    if (!request.session) return reply.code(401).send({ error: 'unauthorized' });
    if (request.session.userId !== ownerId) return reply.code(403).send({ error: 'forbidden' });
  });

  // Callback OAuth2 — récupère le profil Discord, gate sur BOT_OWNER_ID, pose le cookie
  fastify.get('/auth/callback', async (request, reply) => {
    let token;
    try {
      token = await fastify.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
    } catch (err) {
      logger.warn('[dashboard] OAuth2 callback échoué :', err.message);
      return reply.code(400).send({ error: 'oauth_failed' });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.token.access_token}` },
    });
    if (!userRes.ok) {
      return reply.code(502).send({ error: 'discord_userinfo_failed' });
    }
    const user = await userRes.json();

    if (user.id !== ownerId) {
      logger.warn(`[dashboard] Tentative de login refusée : ${user.username} (${user.id})`);
      return reply.code(403).send({ error: 'not_owner' });
    }

    const jwt = fastify.jwt.sign({
      userId:   user.id,
      username: user.username,
      avatar:   user.avatar,
    });

    reply
      .setCookie(SESSION_COOKIE, jwt, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: publicUrl.startsWith('https://'),
        maxAge: 60 * 60 * 24 * 7,
      })
      .redirect('/');
  });

  // Déconnexion
  fastify.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' }).send({ ok: true });
  });

  // Profil de l'utilisateur connecté
  fastify.get('/api/me', { preHandler: fastify.requireOwner }, async (request) => {
    return {
      userId:   request.session.userId,
      username: request.session.username,
      avatar:   request.session.avatar,
      avatarUrl: request.session.avatar
        ? `https://cdn.discordapp.com/avatars/${request.session.userId}/${request.session.avatar}.png?size=128`
        : null,
    };
  });
}
