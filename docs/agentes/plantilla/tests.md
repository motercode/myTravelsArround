# Tests en Next.js: Vitest y Playwright

Guía extraída de comparaluzcv, el único proyecto Next.js de motercode con tests. Allí está escrito
en JavaScript (`*.config.mjs`/`.js`); en un proyecto TypeScript se usan las mismas ideas con `.ts`/`.mts`.

## Tipos y dónde viven

| Tipo | Herramienta | Dónde | Comando |
|---|---|---|---|
| Unitarios (lógica pura, rutas de API, carga de datos) | Vitest | junto al código: `src/lib/x.ts` → `src/lib/x.test.ts` | `npm test` (`vitest run`) |
| E2E (recorridos del usuario en el navegador) | Playwright | `e2e/*.spec.ts` | `npm run test:e2e` (`playwright test`) |

## Instalación

```bash
npm install -D vitest @playwright/test
npx playwright install chromium
```

Scripts en `package.json`:

```json
"test": "vitest run",
"test:e2e": "playwright test"
```

## Configuración

`vitest.config.mts`: entorno `node` y el mismo alias `@` que `tsconfig.json`, para importar como en
el código.

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

`playwright.config.ts`: Playwright arranca el servidor de desarrollo él mismo y reutiliza el que ya
esté abierto. El puerto debe coincidir con el de `npm run dev` del proyecto.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3000', headless: true, trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

**`localhost`, no `127.0.0.1`.** Next.js 16 bloquea en `next dev` los recursos de desarrollo
(`/_next/…`, HMR) pedidos desde un origen distinto de `localhost` («Blocked cross-origin request» en
el log). Con `127.0.0.1` la página se sirve, pero no se hidrata: los clics cambian el DOM y no el
estado, y los componentes solo de cliente no aparecen. Si hace falta otro host, va en
`allowedDevOrigins` de `next.config.ts`.

Next.js 16 también es un proyecto CommonJS por defecto: la configuración de Vitest va en
`vitest.config.mts` para que no avise de sintaxis ESM.

## Reglas

- **Buscar por rol y nombre accesible**, no por clases CSS: `page.getByRole('heading', { level: 1, name: /título/i })`.
  Los tests sobreviven a los cambios de estilo y comprueban de paso la accesibilidad.
- **Comprobar que no hay duplicados** con `toHaveCount(1)` en los bloques principales: detecta
  componentes que se pintan dos veces.
- **Esperar a la hidratación** antes de interactuar: espera a algo que solo pinta el cliente (por
  ejemplo, un control de un componente que se carga con `ssr: false`). Un clic antes cambia el DOM pero no el estado.
- **Un E2E por recorrido**: entrar, navegar a un detalle y comprobar lo que se ve allí.
- **Datos de prueba ficticios** y deterministas; los datos reales no entran en los fixtures
  (ver [privacidad-y-logs.md](privacidad-y-logs.md)).
- Antes de cada PR: `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`, todos en verde.

`test-results/` y `playwright-report/` van al `.gitignore`.
