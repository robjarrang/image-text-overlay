# Text Overlay Image Generator

A Next.js application that allows users to overlay formatted text onto images, with support for text alignment, superscript, & styling.

## Features

- Upload images via URL
- Text formatting with alignment tags ([center], [left], [right])
- Superscript text support (^{text})
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

Azure Static Web Apps is the recommended deployment route for this application. Deploy the `main` branch using the Azure Static Web Apps **Next.js** build preset so the app can keep its Next.js API routes for image proxying and server-side image generation.

### Azure Static Web Apps settings

Use these settings when creating the Static Web App in the Azure Portal:

| Setting | Value |
| --- | --- |
| Deployment source | GitHub |
| Branch | `main` |
| Build preset | Next.js |
| App location | `/` |
| API location | Leave empty |
| Output location | Leave empty |

Do not configure a static export (`output: "export"`) for this app because the Next.js API routes under `src/pages/api/` are required for current functionality.

After the initial deployment succeeds, configure Microsoft Entra ID access control and a TTI/Milwaukee-approved custom domain in Azure if required.

### Vercel

The app has previously been deployed on Vercel, but Azure Static Web Apps is now preferred to avoid use of the shared `vercel.app` domain.

## Built With

- Next.js
- TypeScript
- Salesforce Lightning Design System
- sharp (for image processing)
- html2canvas

## Environment Variables

No environment variables are required for basic functionality.

## Browser Support

Tested and working in modern browsers (Chrome, Firefox, Safari, Edge).
