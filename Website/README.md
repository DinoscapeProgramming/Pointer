# Pointer Website

Marketing website and web presence for the Pointer development suite. Built with Next.js, TypeScript, and Tailwind CSS for a modern, responsive, and fast experience.

![Next.js](https://img.shields.io/badge/Next.js-Website-black) ![TypeScript](https://img.shields.io/badge/TypeScript-Typed-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-blue)

## ✨ Features

### 🌐 **Modern Web Presence**
- **Responsive Design** - Mobile-first approach with perfect desktop experience
- **Fast Performance** - Optimized with Next.js for lightning-fast loading
- **SEO Optimized** - Built-in SEO optimization and meta tags
- **Modern UI** - Clean, professional design with Tailwind CSS

### 📄 **Content & Pages**
- **Landing Page** - Showcase Pointer suite features and benefits
- **Documentation** - Comprehensive guides and API documentation
- **Download Section** - Links to desktop app downloads
- **Community Links** - Discord, GitHub, and social media integration

### 🚀 **Technical Features**
- **Static Site Generation** - Pre-rendered pages for optimal performance
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Component Architecture** - Reusable, maintainable components

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**

### Development Setup

1. **Navigate to Website Directory**
   ```bash
   cd Website/pointer-website
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **View Website**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔧 Build & Deployment

### Local Build

```bash
# Build for production
npm run build
# or
yarn build

# Start production server
npm run start
# or
yarn start

# Export static site
npm run export
# or
yarn export
```

### Static File Serving

Use the Python static server for simple deployment:

```bash
# Navigate to Website directory
cd Website

# Build the site first
cd pointer-website && npm run build && cd ..

# Serve static files
python web.py
```

The site will be available at `http://localhost:5000`

### Build Script

Use the provided build script:

```bash
# Make executable (Linux/macOS)
chmod +x build.sh

# Run build
./build.sh
```

## 📁 Project Structure

```
Website/
├── pointer-website/              # Next.js application
│   ├── src/                      # Source code
│   │   ├── app/                  # Next.js app directory
│   │   │   ├── page.tsx          # Landing page
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── globals.css       # Global styles
│   │   │   ├── download/         # Download page
│   │   │   ├── docs/             # Documentation pages
│   │   │   └── about/            # About page
│   │   ├── components/           # Reusable components
│   │   │   ├── Header.tsx        # Site header
│   │   │   ├── Footer.tsx        # Site footer
│   │   │   ├── Hero.tsx          # Hero section
│   │   │   └── Features.tsx      # Features showcase
│   │   └── lib/                  # Utility functions
│   ├── public/                   # Static assets
│   │   ├── images/               # Image assets
│   │   ├── icons/                # Icon files
│   │   └── favicon.ico           # Site favicon
│   ├── styles/                   # Additional styles
│   ├── next.config.ts            # Next.js configuration
│   ├── tailwind.config.ts        # Tailwind configuration
│   ├── package.json              # Dependencies
│   └── README.md                 # Next.js default README
├── web.py                        # Python static server
├── build.sh                      # Build automation script
└── README.md                     # This file
```

## ⚙️ Configuration

### Next.js Configuration

Edit `pointer-website/next.config.ts`:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
```

### Tailwind Configuration

Customize styling in `pointer-website/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#your-primary-color',
        secondary: '#your-secondary-color',
      }
    },
  },
  plugins: [],
}
```

### Environment Variables

Create `.env.local` for environment-specific settings:

```env
# Site configuration
NEXT_PUBLIC_SITE_URL=https://pointr.sh
NEXT_PUBLIC_DISCORD_INVITE=https://discord.gg/vhgc8THmNk
NEXT_PUBLIC_GITHUB_URL=https://github.com/PointerIDE/Pointer

# Analytics (optional)
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

## 🎨 Development

### Adding New Pages

1. **Create page file** in `src/app/`
2. **Add navigation** to header component
3. **Update sitemap** if needed

Example new page:

```typescript
// src/app/features/page.tsx
export default function FeaturesPage() {
  return (
    <div>
      <h1>Features</h1>
      <p>Detailed feature descriptions...</p>
    </div>
  )
}
```

### Creating Components

```typescript
// src/components/NewComponent.tsx
interface Props {
  title: string;
  description: string;
}

export default function NewComponent({ title, description }: Props) {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}
```

### Styling Guidelines

- **Use Tailwind classes** for styling
- **Follow mobile-first** responsive design
- **Maintain consistent** spacing and typography
- **Use semantic HTML** elements

## 🚢 Deployment Options

### Vercel (Recommended)

1. **Connect GitHub repository** to Vercel
2. **Configure build settings**:
   - Build Command: `cd Website/pointer-website && npm run build`
   - Output Directory: `Website/pointer-website/out`
3. **Deploy automatically** on push to main branch

### Netlify

1. **Connect repository** to Netlify
2. **Set build settings**:
   - Build command: `cd Website/pointer-website && npm run build && npm run export`
   - Publish directory: `Website/pointer-website/out`

### GitHub Pages

```bash
# Build and deploy to gh-pages branch
cd pointer-website
npm run build
npm run export

# Deploy to GitHub Pages
npx gh-pages -d out
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY pointer-website/package*.json ./
RUN npm install

COPY pointer-website/ ./
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Static Hosting

For simple static hosting:

```bash
# Build static files
cd pointer-website
npm run build
npm run export

# Upload the 'out' directory to your static host
# (AWS S3, CloudFlare Pages, etc.)
```

## 🛠️ Troubleshooting

### Common Issues

**Build Failures**
```bash
# Clear Next.js cache
rm -rf .next

# Clear dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

**Development Server Issues**
```bash
# Check port availability
lsof -i :3000

# Use different port
PORT=3001 npm run dev
```

**Static Export Issues**
```bash
# Ensure all images are optimized for export
# Check next.config.ts for export settings
# Verify no dynamic routes without static params
```

### Performance Optimization

- **Optimize images** with Next.js Image component
- **Use lazy loading** for components below the fold
- **Minimize JavaScript bundles** with code splitting
- **Enable compression** on your hosting platform

## 📊 Analytics & SEO

### Google Analytics

Add to `src/app/layout.tsx`:

```typescript
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <GoogleAnalytics gaId="GA_MEASUREMENT_ID" />
      </body>
    </html>
  )
}
```

### SEO Optimization

```typescript
// src/app/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pointer - Modern Code Editor',
  description: 'AI-powered code editor with VS Code-like interface',
  keywords: 'code editor, AI, development, programming',
  openGraph: {
    title: 'Pointer Code Editor',
    description: 'Modern development suite with AI assistance',
    url: 'https://pointr.sh',
    siteName: 'Pointer',
    images: ['/images/og-image.png'],
  },
}
```

## 🤝 Contributing to Website

### Content Guidelines

- **Write clear, concise copy** that explains features
- **Use consistent terminology** across pages
- **Maintain professional tone** while being approachable
- **Include call-to-action buttons** where appropriate

### Design Guidelines

- **Follow established design system**
- **Maintain consistent spacing** using Tailwind utilities
- **Ensure accessibility** with proper semantic HTML
- **Test on multiple devices** and screen sizes

### Development Workflow

1. **Create feature branch** for changes
2. **Test locally** with `npm run dev`
3. **Build successfully** with `npm run build`
4. **Check responsiveness** on different screen sizes
5. **Submit pull request** with screenshots

## 📝 License

This component is part of the Pointer project, licensed under the MIT License.

## 🙏 Acknowledgments

- **Next.js** - React framework for production
- **Tailwind CSS** - Utility-first CSS framework
- **Vercel** - Deployment and hosting platform
- **TypeScript** - Type-safe JavaScript

---

**[← Back to Main README](../README.md)** | **[Code Editor Component →](../App/README.md)** | **[Discord Bots →](../DiscordBot/README.md)** 
