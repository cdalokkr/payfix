# New Login Form Demo - Setup Instructions

## Overview

This document provides comprehensive setup instructions for testing the new login form demo page. The demo showcases a modernized login form built with React Hook Form, Zod validation, and shadcn/ui components.

## Quick Start

### 1. Prerequisites

Before running the demo, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (or yarn 1.22.0+)
- **Git**: For version control

### 2. Installation Steps

```bash
# Clone the repository
git clone <your-repository-url>
cd my-fullstack-app

# Install dependencies
npm install
# or
yarn install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# tRPC Configuration
TRPC_SECRET=your_trpc_secret_key

# Optional: Development settings
NODE_ENV=development
```

### 4. Running the Demo

#### Development Mode
```bash
npm run dev
# or
yarn dev
```

The application will be available at: `http://localhost:3000`

#### Access the Demo
Navigate to the demo page: `http://localhost:3000/demo-new-login`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build the application for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint for code quality |
| `npm run test` | Run Jest test suite |

## Demo Features

### Login Form Capabilities
- **Real-time Validation**: Instant feedback using Zod schema
- **Enhanced Error Handling**: Granular error messages
- **Responsive Design**: Works on all device sizes
- **Accessibility**: ARIA compliant with proper labels
- **Password Strength**: Smart validation with visual feedback

### Testing Scenarios

The demo includes test credentials to verify different scenarios:

1. **Admin Login**: `admin@example.com` / `Admin123!`
2. **User Login**: `user@example.com` / `UserPass123!`
3. **Invalid Credentials**: `invalid@test.com` / `wrongpass`

### Demo Page Sections

1. **Live Form Demo**: Interactive login form
2. **Features & Validation**: Detailed feature showcase
3. **Setup Instructions**: Complete setup guide

## Dependencies

### Core Technologies
- **React**: ^19.2.0
- **Next.js**: ^16.0.1
- **TypeScript**: ^5.x
- **Tailwind CSS**: ^4.x

### Form & Validation
- **React Hook Form**: ^7.64.0
- **Zod**: ^4.1.12
- **@hookform/resolvers**: ^5.2.2

### UI Components
- **shadcn/ui**: Latest
- **@radix-ui/***: Various Radix primitives
- **lucide-react**: ^0.544.0
- **framer-motion**: ^12.23.24

### Backend & API
- **tRPC**: ^11.6.0
- **@supabase/supabase-js**: ^2.58.0
- **@tanstack/react-query**: ^5.90.2

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 3000
   npx kill-port 3000
   # Then run again
   npm run dev
   ```

2. **Module Not Found**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Environment Variables**
   - Ensure `.env.local` exists in the root directory
   - Verify all required environment variables are set
   - Restart the development server after changing `.env.local`

4. **Build Errors**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run dev
   ```

### Development Tips

1. **Hot Reload**: The development server automatically reloads on file changes
2. **TypeScript**: Check `.ts` files for type errors
3. **ESLint**: Run `npm run lint` to check code quality
4. **Component Structure**: All shadcn/ui components are in `components/ui/`

## Project Structure

```
my-fullstack-app/
├── app/
│   ├── demo-new-login/
│   │   └── page.tsx          # Demo page
│   └── page.tsx              # Home page
├── components/
│   ├── auth/
│   │   └── new-login-form.tsx # Main login component
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── trpc/                 # tRPC configuration
│   └── utils.ts              # Utility functions
└── package.json              # Dependencies
```

## Next Steps

After testing the demo:

1. **Review the Code**: Examine `components/auth/new-login-form.tsx`
2. **Customize**: Modify the form for your specific requirements
3. **Integrate**: Connect to your authentication system
4. **Deploy**: Build and deploy to your preferred platform

## Support

For issues or questions:
- Check the console for error messages
- Verify all dependencies are properly installed
- Ensure environment variables are correctly configured
- Review the [Next.js documentation](https://nextjs.org/docs)

## Production Deployment

When ready for production:

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Test the Production Build**
   ```bash
   npm run start
   ```

3. **Deploy to Your Platform**
   - Vercel: `vercel deploy`
   - Netlify: `netlify deploy`
   - Other: Follow your platform's deployment guide

## Additional Resources

- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)