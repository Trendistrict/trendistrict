# Convex + Clerk + Next.js Setup Guide

This guide will help you set up your own Convex backend and Clerk authentication for this Next.js application.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- A Clerk account (free)
- A Convex account (free)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd vibed-starter-web

# Install dependencies
npm install
```

## Step 2: Set Up Clerk

1. **Create a Clerk Account**
   - Go to [clerk.com](https://clerk.com) and sign up
   - Create a new application
   - Choose "Next.js" as your framework

2. **Get Your Clerk Keys**
   - In your Clerk Dashboard, go to **API Keys**
   - Copy your **Publishable Key** (starts with `pk_test_`)
   - Copy your **Secret Key** (starts with `sk_test_`)

3. **Configure JWT Template in Clerk**

   **This is critical for Clerk to work with Convex:**

   - In your Clerk Dashboard, go to **JWT Templates** in the sidebar
   - Click **New Template** and select **Convex**
   - Name it exactly `convex` (lowercase, this exact name is important)
   - Set the **Issuer** to your Clerk domain (e.g., `https://your-app.clerk.accounts.dev`)
   - Save the template

4. **Get Your Clerk Domain**
   - In your Clerk Dashboard, go to **API Keys**
   - Note your Frontend API URL (e.g., `https://your-app.clerk.accounts.dev`)
   - You'll need this for Step 4

## Step 3: Initialize Convex

1. **Create a Convex Account**
   - Go to [convex.dev](https://convex.dev) and sign up
   - Create a new project

2. **Initialize Convex in Your Project**

   **Important: You must run this command yourself in your terminal** (not through an AI agent) as it's an interactive setup:

   ```bash
   npx convex dev
   ```
   - When prompted, select "Create a new project"
   - Enter your project name
   - This will create a `.env.local` file with your Convex deployment URL
   - Copy the deployment URL (it looks like `https://your-project.convex.cloud`)

## Step 4: Configure Convex Authentication

Now that Convex is initialized, configure it to work with Clerk:

1. **Add Clerk JWT Issuer Domain**
   - In your Convex Dashboard, go to **Settings** → **Environment Variables**
   - Add a new variable:
     - Name: `CLERK_JWT_ISSUER_DOMAIN`
     - Value: Your Clerk Frontend API URL (from Step 2.4)

2. **Update Convex Auth Config**

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

## Step 5: Configure Environment Variables

1. **Create or update `.env.local` file** in the root directory with your credentials:

   ```env
   # Convex Configuration (auto-populated by npx convex dev)
   NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

   # Clerk Configuration
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_key_here
   ```

   **Where to find these:**
   - `NEXT_PUBLIC_CONVEX_URL`: Auto-populated from Step 3, or copy from Convex Dashboard
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk Dashboard → API Keys → Publishable key
   - `CLERK_SECRET_KEY`: Clerk Dashboard → API Keys → Secret key

   **Note for AI Agent Users**: If you're working with an AI agent (like Claude Code), you can paste your Clerk keys directly in the chat, and the agent will create or update the `.env.local` file for you. The `NEXT_PUBLIC_CONVEX_URL` should already be populated from Step 3.

2. **Verify your setup**:
   - Ensure `.env.local` is in your `.gitignore` (it should be by default)
   - Never commit your actual keys to version control

## Step 6: Run the Application

**Important: You must run this command yourself in your terminal** (not through an AI agent):

```bash
npm run dev
```

This starts:
- Next.js frontend at `http://localhost:3000`
- Convex backend (dashboard opens automatically)

### Alternative: Run Services Individually

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

## Step 7: Test the Integration

1. **Sign Up Flow**
   - Open `http://localhost:3000`
   - You'll see the Clerk sign-in component
   - Click "Sign up" to create a new account
   - Enter your email and password
   - Check your email for the verification code
   - Enter the code to complete signup

2. **Authentication Flow**
   - After signing in, you should be authenticated
   - The app will have access to your user session
   - Protected routes (e.g., `/server/*`) will be accessible

3. **Real-time Database**
   - Any Convex queries and mutations will work with your authenticated session
   - Check the Convex dashboard to see real-time function calls and data

4. **Sign Out**
   - Use the Clerk `<UserButton />` component or sign out functionality
   - You'll be redirected to the sign-in screen

## Troubleshooting

### "Missing Clerk Publishable Key" Error
- Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
- Restart the Next.js dev server after adding environment variables

### "Convex client not configured" Error
- Ensure `NEXT_PUBLIC_CONVEX_URL` is set correctly in `.env.local`
- Check that your Convex dev server is running: `npm run dev:backend`
- Verify your internet connection

### Authentication Not Working
- Verify the JWT template in Clerk is named exactly "convex"
- Check that `CLERK_JWT_ISSUER_DOMAIN` is set in Convex Dashboard environment variables
- Ensure `convex/auth.config.ts` has the correct domain
- Check that you're using the correct Clerk publishable key and secret key

### Build Errors
- Run `npm run lint` to check for linting issues
- Ensure all environment variables are set
- Clear the `.next` cache: `rm -rf .next` and rebuild

### Middleware Issues
- Check `middleware.ts` configuration
- Ensure protected routes are properly configured
- Verify Clerk middleware is correctly set up

## Production Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "New Project"
   - Import your GitHub repository

3. **Add Environment Variables**
   - In Vercel dashboard, go to **Settings** → **Environment Variables**
   - Add all variables from your `.env.local`:
     - `NEXT_PUBLIC_CONVEX_URL`
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`

4. **Deploy**
   - Vercel will automatically deploy on every push to main
   - Your app will be live at `https://your-app.vercel.app`

### Deploy Convex

1. **Configure Auto-Deploy**
   - In Convex Dashboard, go to **Settings** → **Deploy Settings**
   - Connect your GitHub repository
   - Convex will automatically deploy when you push to main

2. **Manual Deploy**
   ```bash
   npx convex deploy --prod
   ```

### Production Environment Variables

For production:
- Use production Clerk keys (not `_test_` keys)
- Use production Convex deployment URL
- Set up proper environment management in Vercel

### Security Checklist

- [ ] Enable appropriate auth rules in Convex functions
- [ ] Configure allowed domains in Clerk dashboard
- [ ] Set up proper CORS policies if needed
- [ ] Review middleware route protection
- [ ] Enable rate limiting if needed

## Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only Next.js frontend with Turbopack
- `npm run dev:backend` - Start only Convex backend
- `npm run build` - Build Next.js for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
├── app/                 # Next.js pages and layouts (App Router)
│   ├── layout.tsx       # Root layout with ClerkProvider
│   └── ...
├── components/          # React components
│   ├── ConvexClientProvider.tsx  # Convex + Clerk integration
│   └── ...
├── convex/             # Backend functions, schema, and auth
│   ├── auth.config.ts  # Clerk authentication config
│   ├── schema.ts       # Database schema
│   └── *.ts            # Server functions (queries, mutations, actions)
├── middleware.ts       # Route protection with Clerk
├── public/             # Static assets
└── ...
```

## Additional Resources

- [Convex Documentation](https://docs.convex.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Convex + Clerk Integration Guide](https://docs.convex.dev/auth/clerk)
- [Next.js + Clerk Guide](https://clerk.com/docs/quickstarts/nextjs)

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the console logs in your browser and terminal
3. Check the Convex Dashboard for function errors
4. Review the Clerk Dashboard for authentication issues
5. Open a GitHub issue with detailed error messages

## Next Steps

Once your setup is complete, you can:
- Customize the authentication flow with Clerk components
- Add social login providers in Clerk (Google, GitHub, etc.)
- Define your database schema in `convex/schema.ts`
- Create Convex functions (queries, mutations, actions)
- Add protected routes with middleware
- Implement real-time features with Convex subscriptions
- Deploy to production on Vercel
- Add monitoring and error tracking

---

**Happy coding! 🎉**

For questions or issues, please open a GitHub issue or check the documentation links above.
