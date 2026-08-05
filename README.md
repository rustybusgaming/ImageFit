# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # ImageFit

  ImageFit is a browser-based image editor for preparing one source image for several social-media and profile-image formats. Upload an image, position the crop, choose the presets you need, and download individual files or a ZIP bundle.

  All image editing and export work happens locally in the browser. Uploaded files are not sent to a server.

  ## Features

  - Upload JPG, PNG, WebP, GIF, or SVG images up to 20 MB, or MP4, WebM, MOV, and M4V videos up to 250 MB.
  - Crop, zoom, and rotate the source image.
  - Export presets for Instagram, Discord, GitHub, LinkedIn, Open Collective, YouTube, Roblox, Twitch, X, and TikTok.
  - Choose JPEG, PNG, or WebP output with adjustable quality.
  - Choose a crop, blurred backdrop, solid colour, gradient, or transparent background where the output format supports it.
  - Apply monochrome, warm, or colour-pop effects.
  - Download one export directly or package several exports into a ZIP file.
  - Compress the original image with size and quality presets.
  - Use Discord 5 MB and 10 MB image presets that encode to the selected maximum size.
  - Transcode videos locally to MP4, WebM, MOV, AVI, OGV, or GIF files sized for Discord's 5 MB or 10 MB upload limits.
  - Encode H.264, H.265/HEVC, AV1, VP8, VP9, MPEG-4 Part 2, ProRes, DNxHD, MJPEG, and Theora video.

  ## Run Locally

  ### Prerequisites

  - Node.js 20 or later
  - npm 10 or later, or pnpm 9 or later

  ### Install and start

  ```bash
  pnpm install
  pnpm dev
  ```

  Vite prints the local development URL when the server starts. To use npm instead:

  ```bash
  npm install
  npm run dev
  ```

  ## Commands

  ```bash
  # Start the Vite development server
  npm run dev

  # Run ESLint
  npm run lint

  # Type-check and create a production build in dist/
  npm run build

  # Preview the production build locally
  npm run preview
  ```

  ## Website And Desktop Releases

  ImageFit is available in two forms:

  - **Website:** GitHub Actions builds `dist/` and deploys it to GitHub Pages whenever `main` is updated.
  - **Desktop:** Electron packages the same interface with native FFmpeg video processing. Download the Linux AppImage, Windows portable `.exe`, or Windows NSIS installer from the GitHub Releases page.

  ### Desktop development

  ```bash
  # Run the Electron app locally
  pnpm desktop

  # Create a Linux AppImage in release/
  pnpm desktop:package:linux

  # Create a Windows portable executable in release/
  pnpm desktop:package:win
  ```

  ### Desktop video engines

  ImageFit Desktop detects available hardware encoders from its bundled FFmpeg build. H.264, H.265/HEVC, and AV1 can use NVIDIA NVENC, Intel Quick Sync, AMD AMF, or Apple VideoToolbox when the selected codec and installed graphics driver support them. Software FFmpeg remains available for every codec. The browser version always uses software FFmpeg.

  The desktop control in the app header shows detected hardware encoders, selects the native output folder, opens media through the operating system, and reports available release updates. The Windows installer creates Start-menu and desktop shortcuts and registers supported image and video files to open in ImageFit.

  Push a version tag such as `v0.1.0` to build both desktop targets and publish their artifacts to a GitHub release:

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

  ## How It Works

  1. Upload an image from your device.
  2. Adjust the crop, zoom, and rotation in the editor.
  3. Select one or more platform presets.
  4. Configure the output format, quality, background, and optional effect.
  5. Export a single image or download all selected formats in `imagefit-export.zip`.

  The Image Squish panel provides a separate quick-compression workflow for the original upload. It does not apply the editor crop or export settings.

  ## Technology

  - React and TypeScript
  - Vite
  - Tailwind CSS
  - `react-easy-crop` for image positioning
  - JSZip and FileSaver for batch downloads

  ## Project Structure

  ```text
  src/
    components/  User interface and image workflow controls
    data/        Social-platform preset dimensions
    hooks/       Upload and object-URL lifecycle handling
    lib/         Canvas processing, downloads, and ZIP creation
  ```
