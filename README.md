# Next.js + Convex + Clerk Starter Template

A modern full-stack TypeScript starter template with authentication, real-time database, and beautiful UI components.

## 🚀 Tech Stack

- **Frontend**: Next.js 15 with App Router, Tailwind CSS 4
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Clerk
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components

## 📋 Prerequisites

Before you begin, make sure you have:

- Node.js 18+ installed
- npm or yarn package manager
- A Clerk account (free)
- A Convex account (free)

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd template-nextjs-clerk
npm install
```

### 2. Set Up Convex

1. **Create a Convex account**: Go to [convex.dev](https://convex.dev) and sign up
2. **Install Convex CLI**:
   ```bash
   npm install -g convex
   ```
3. **Login to Convex**:
   ```bash
   npx convex login
   ```
4. **Initialize your project**:
   ```bash
   npx convex dev
   ```
   - This will create a new Convex project and give you a deployment URL
   - Copy the deployment URL (it looks like `https://your-project.convex.cloud`)

### 3. Set Up Clerk

1. **Create a Clerk account**: Go to [clerk.com](https://clerk.com) and sign up
2. **Create a new application** in your Clerk dashboard
3. **Get your keys** from the Clerk dashboard:
   - Go to "API Keys" in your Clerk dashboard
   - Copy the "Publishable key" and "Secret key"

### 4. Configure JWT Template in Clerk

This is **critical** for Clerk to work with Convex:

1. In your Clerk dashboard, go to **"JWT Templates"**
2. Click **"New template"**
3. Select **"Convex"** from the list
4. Name it `convex` (lowercase)
5. Set the **Issuer** to your Clerk domain (e.g., `https://your-app.clerk.accounts.dev`)
6. Save the template

### 5. Environment Variables

Create a `.env.local` file in your project root:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Where to find these:**
- `NEXT_PUBLIC_CONVEX_URL`: From step 2 when you ran `npx convex dev`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk dashboard → API Keys → Publishable key
- `CLERK_SECRET_KEY`: Clerk dashboard → API Keys → Secret key

### 6. Configure Convex Environment Variables

1. Go to your [Convex dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **"Settings"** → **"Environment Variables"**
4. Add this variable:
   ```
   CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
   ```
   (Replace with your actual Clerk issuer domain from step 4)

### 7. Update Convex Auth Config

Update `convex/auth.config.ts` with your Clerk domain:

```typescript
export default {
  providers: [
    {
      domain: "https://your-app.clerk.accounts.dev", // Replace with your domain
      applicationID: "convex",
    },
  ]
};
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Run both frontend and backend
npm run dev
```

This starts:
- Next.js frontend at `http://localhost:3000`
- Convex backend (dashboard opens automatically)

### Individual Services

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

### Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔧 Available Scripts

- `npm run dev` - Start development servers (frontend + backend)
- `npm run dev:frontend` - Start only Next.js frontend
- `npm run dev:backend` - Start only Convex backend
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📁 Project Structure

```
├── app/                 # Next.js pages (App Router)
├── components/          # React components
├── convex/             # Backend functions and schema
│   ├── auth.config.ts  # Clerk authentication config
│   ├── schema.ts       # Database schema
│   └── myFunctions.ts  # Server functions
├── public/             # Static assets
├── middleware.ts       # Route protection
└── ...
```

## 🔐 Authentication Flow

This template includes:
- Sign up/Sign in pages via Clerk
- Protected routes using middleware
- User session management
- Integration between Clerk and Convex for authenticated API calls

## 🗄️ Database

Convex provides:
- Real-time database with TypeScript schema
- Serverless functions
- Real-time subscriptions
- Automatic scaling

Define your schema in `convex/schema.ts` and create functions in `convex/myFunctions.ts`.

## 🆘 Troubleshooting

### Common Issues

1. **"Convex client not configured"**
   - Check your `NEXT_PUBLIC_CONVEX_URL` in `.env.local`
   - Make sure Convex dev server is running

2. **Authentication not working**
   - Verify JWT template is created in Clerk with issuer domain
   - Check `CLERK_JWT_ISSUER_DOMAIN` in Convex dashboard
   - Ensure `convex/auth.config.ts` has correct domain

3. **Build errors**
   - Run `npm run lint` to check for linting issues
   - Ensure all environment variables are set

### Getting Help

- [Convex Documentation](https://docs.convex.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repo to [Vercel](https://vercel.com)
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Deploy Convex

Convex automatically deploys when you push to your main branch. Configure this in your Convex dashboard under "Settings" → "Deploy Settings".

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

**Happy coding! 🎉**

For questions or issues, please open a GitHub issue or check the documentation links above.