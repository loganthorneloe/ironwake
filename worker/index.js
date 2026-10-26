import { feedbackRoute } from './feedback.js';
export { FeedbackReport } from './feedback.js';
const prefix = '/ironwake';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === prefix) {
      url.pathname += '/';
      return Response.redirect(url, 308);
    }
    // The wildcard route also matches /ironwake-other. Leave it to the site.
    if (!url.pathname.startsWith(prefix + '/')) return fetch(request);
    if (url.pathname.startsWith(prefix + '/api/feedback')) return feedbackRoute(request, env);
    url.pathname = url.pathname.slice(prefix.length);
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    if (url.pathname === '/') url.pathname = '/index.html';
    const asset = await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(asset.body, asset);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Cache-Control', 'no-cache');
    return response;
  },
};
