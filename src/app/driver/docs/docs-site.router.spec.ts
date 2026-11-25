import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as express from 'express';
import * as request from 'supertest';
import {
  buildSidebarMarkdown,
  createDocsSiteRouter,
  readDocsSiteConfig,
  type DocsSiteCredentials
} from './docs-site.router';

describe('docs site', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = mkdtempSync(join(tmpdir(), 'madre-docs-'));
    mkdirSync(join(rootDirectory, 'docs'));
    writeFileSync(join(rootDirectory, 'README.md'), '# Madre API\n');
    writeFileSync(join(rootDirectory, 'docs', 'funcional.md'), '# Guía\n');
    writeFileSync(join(rootDirectory, 'docs', 'operacion.md'), '# Operación\n\nEl servicio corre en /root/madre-api\n');
    // Things that live next to the docs and must never be served.
    writeFileSync(join(rootDirectory, '.env'), 'INTERNAL_API_KEY=x\n');
    writeFileSync(join(rootDirectory, 'docs', 'notas-internas.md'), 'secreto');
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  function createApp(credentials?: DocsSiteCredentials) {
    const app = express();
    app.use('/docs', createDocsSiteRouter({ basePath: '/docs', rootDirectory, credentials }));
    return app;
  }

  describe('open, without credentials', () => {
    it('serves the page shell pointing at its own content path', async () => {
      const response = await request(createApp()).get('/docs/');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('"/docs/content/"');
    });

    it('serves the README as the home page and the docs under their repository path', async () => {
      const app = createApp();

      const home = await request(app).get('/docs/content/README.md');
      const guide = await request(app).get('/docs/content/docs/funcional.md');

      expect(home.text).toBe('# Madre API\n');
      expect(guide.text).toBe('# Guía\n');
      expect(guide.headers['content-type']).toContain('text/markdown');
      // A git pull has to be enough to publish a text change.
      expect(guide.headers['cache-control']).toBe('no-cache');
    });

    it('does not publish the page about the server, in the sidebar or by URL', async () => {
      const app = createApp();

      const sidebar = await request(app).get('/docs/content/_sidebar.md');
      const page = await request(app).get('/docs/content/docs/operacion.md');

      expect(sidebar.text).not.toContain('operacion');
      expect(page.status).toBe(200);
      expect(page.text).toContain('no está publicada');
      expect(page.text).not.toContain('/root/madre-api');
    });

    it('only serves the files it lists, whatever else sits in the repository', async () => {
      const app = createApp();

      const unlisted = await request(app).get('/docs/content/docs/notas-internas.md');
      const traversal = await request(app).get('/docs/content/docs/..%2F.env');
      const env = await request(app).get('/docs/content/.env');

      expect(unlisted.status).toBe(404);
      expect(traversal.status).toBe(404);
      expect(env.status).toBe(404);
    });
  });

  describe('behind credentials', () => {
    const credentials = { username: 'tlq', password: 'una-clave' };

    it('asks for them on every route', async () => {
      const app = createApp(credentials);

      for (const path of [
        '/docs/',
        '/docs/content/README.md',
        '/docs/content/_sidebar.md',
        '/docs/content/docs/operacion.md'
      ]) {
        const response = await request(app).get(path);

        expect(response.status).toBe(401);
        expect(response.headers['www-authenticate']).toContain('Basic');
      }
    });

    it('rejects a wrong password', async () => {
      const response = await request(createApp(credentials)).get('/docs/content/README.md').auth('tlq', 'otra-clave');

      expect(response.status).toBe(401);
    });

    it('publishes every page, the one about the server included', async () => {
      const app = createApp(credentials);

      const sidebar = await request(app)
        .get('/docs/content/_sidebar.md')
        .auth(credentials.username, credentials.password);
      const page = await request(app)
        .get('/docs/content/docs/operacion.md')
        .auth(credentials.username, credentials.password);

      expect(sidebar.text).toContain('(/docs/operacion.md)');
      expect(page.text).toContain('/root/madre-api');
    });
  });

  describe('configuration from the environment', () => {
    it('is enabled at /docs and open by default', () => {
      expect(readDocsSiteConfig({})).toEqual({ enabled: true, path: '/docs', credentials: undefined });
    });

    it('asks for credentials only when both user and password are set', () => {
      expect(readDocsSiteConfig({ DOCS_SITE_USER: 'tlq' }).credentials).toBeUndefined();
      expect(readDocsSiteConfig({ DOCS_SITE_USER: 'tlq', DOCS_SITE_PASSWORD: ' ' }).credentials).toBeUndefined();
      expect(readDocsSiteConfig({ DOCS_SITE_USER: 'tlq', DOCS_SITE_PASSWORD: 'clave' }).credentials).toEqual({
        username: 'tlq',
        password: 'clave'
      });
    });

    it('can be turned off or moved', () => {
      expect(readDocsSiteConfig({ DOCS_SITE_ENABLED: 'false' }).enabled).toBe(false);
      expect(readDocsSiteConfig({ DOCS_SITE_PATH: '/manual' }).path).toBe('/manual');
    });
  });

  it('groups the sidebar by section, in order', () => {
    expect(buildSidebarMarkdown(true)).toBe(
      [
        '- **Inicio**',
        '  - [Madre API](/)',
        '- **Funcional**',
        '  - [Guía funcional](/docs/funcional.md)',
        '  - [Procesos y estados](/docs/procesos.md)',
        '- **API**',
        '  - [Referencia de la API](/docs/api.md)',
        '- **Técnico**',
        '  - [Arquitectura y configuración](/docs/tecnico.md)',
        '  - [Operación](/docs/operacion.md)',
        ''
      ].join('\n')
    );
  });
});
