# Next Netlify Template

Plantilla base para crear aplicaciones con **Next.js**, **TypeScript**, **Tailwind CSS 4**, **shadcn/ui** y **Netlify**.

## Requisitos

- Node.js 22
- npm

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación estará disponible en <http://localhost:3000>.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run lint     # ESLint
npm run build    # build de producción
npm run start    # servidor de producción
```

## Estructura

```text
src/
  app/
    globals.css  estilos globales y variables de tema
    layout.tsx   layout y metadatos
    page.tsx     página inicial
  components/
    ui/          componentes reutilizables de shadcn/ui
  lib/
    utils.ts     utilidades compartidas

.env.example     variables de entorno de ejemplo
netlify.toml     configuración de build y desarrollo en Netlify
```

## Variables de entorno

Copia `.env.example` a `.env.local` y ajusta sus valores:

```bash
cp .env.example .env.local
```

Netlify define automáticamente `URL` en los despliegues. Para otros entornos se puede usar `NEXT_PUBLIC_APP_URL`.

## Despliegue en Netlify

Importa el repositorio en Netlify. La configuración de `netlify.toml` define:

- `npm run build` como comando de build.
- `.next` como directorio de publicación.
- Node.js 22.
- El plugin oficial de Next.js para Netlify.

Cada push a la rama principal generará un nuevo despliegue.

## Crear un proyecto desde esta plantilla

En GitHub, abre este repositorio y selecciona **Use this template**. Después, en el nuevo repositorio:

```bash
npm install
npm run dev
```

Actualiza el nombre, la descripción y los metadatos de `src/app/layout.tsx` para tu aplicación.
