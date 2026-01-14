const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/widget10-api',
    createProxyMiddleware({
      target: 'http://widget10-backend:8011',
      changeOrigin: true,
      pathRewrite: { '^/widget10-api': '/service' },
      secure: false,
      logLevel: 'warn'
    })
  );
};
