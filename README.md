# Text Overlay Image Generator

A Next.js application that allows users to overlay formatted text onto images, with support for text alignment, superscript, and styling.

## Features

- Upload images via URL
- Text formatting with alignment tags (`[center]`, `[left]`, `[right]`)
- Superscript text support (`^{text}`)
- Font size and color customization
- Image preview with real-time updates
- Share settings via URL
- Download result as JPEG

## Getting Started

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Deployment

Azure Static Web Apps is the recommended deployment target for the `main` branch. Use the Azure Static Web Apps **Next.js** build preset so the hybrid Next.js app and its API routes are deployed together; do not configure a static export for this project.

### Azure Static Web Apps settings

When creating the Static Web App in the Azure Portal, use these build settings:

| Setting | Value |
| --- | --- |
| Deployment source | GitHub |
| Branch | `main` |
| Build preset | Next.js |
| App location | `/` |
| API location | Leave empty |
| Output location | Leave empty |

The repository includes `staticwebapp.config.json` with a health-check exception, conservative global security headers, and the Node 22 API runtime for Azure-managed server-side Next.js/API execution.

After the initial deployment succeeds, configure Microsoft Entra ID access control and a TTI/Milwaukee-approved custom domain in Azure if required.

### Vercel

The app was previously deployed on Vercel. Vercel-specific deployment is no longer the recommended path for this branch because the client is moving hosting to Azure Static Web Apps.

## Built With

- Next.js
- TypeScript
- Salesforce Lightning Design System
- sharp (for server-side image processing)
- html2canvas

## Environment Variables

No environment variables are required for basic functionality.

## Browser Support

Tested and working in modern browsers (Chrome, Firefox, Safari, Edge).
