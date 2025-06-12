# SoulSeer Deployment Guide

This document outlines the steps to deploy the SoulSeer application to Railway, as well as alternative deployment options.

## Environment Variables

SoulSeer uses environment variables for configuration across both client and server components. These variables control database connections, API keys, feature flags, and other application settings.

### Setup Instructions

1. Copy the example environment file to create your local environment configuration:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and fill in the appropriate values for your environment (development, staging, or production).

3. For deployment, ensure these variables are set in your hosting platform (Railway, Vercel, etc.).

### Key Environment Variables

| Variable | Description | Used In | Example Value |
|----------|-------------|---------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Server | `postgresql://user:pass@localhost:5432/soulseer` |
| `PORT` | Server port (defaults to 3000) | Server | `3000` |
| `NODE_ENV` | Environment mode | Both | `development` or `production` |
| `SESSION_SECRET` | Secret for session encryption | Server | `random-secure-string` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Server | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Server | `whsec_...` |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key | Client | `pk_test_...` |
| `MUX_TOKEN_ID` | MUX API token ID | Server | `your-mux-token-id` |
| `MUX_TOKEN_SECRET` | MUX API token secret | Server | `your-mux-token-secret` |
| `MUX_WEBHOOK_SECRET` | MUX webhook signing secret | Server | `your-mux-webhook-secret` |
| `VITE_API_URL` | Backend API URL | Client | `http://localhost:3000/api` or production URL |
| `VITE_WEBSOCKET_URL` | WebSocket server URL | Client | `ws://localhost:3000` or production URL |
| `VITE_ENABLE_WEBSOCKET` | Enable WebSocket features | Client | `true` or `false` |
| `VITE_ENABLE_LIVESTREAMS` | Enable livestream features | Client | `true` or `false` |
| `VITE_ENABLE_CHECKOUT` | Enable payment checkout | Client | `true` or `false` |
| `VITE_ENABLE_PWA` | Enable Progressive Web App features | Client | `true` or `false` |
| `VITE_ENABLE_NOTIFICATIONS` | Enable push notifications | Client | `true` or `false` |
| `VITE_APP_VERSION` | Application version | Both | `1.0.0` |
| `VITE_APP_DOMAIN` | Application domain | Client | `soulseer.app` |
| `VITE_APP_STORE_ID` | iOS App Store ID | Client | `your-app-store-id` |
| `VITE_PLAY_STORE_ID` | Google Play Store ID | Client | `your-play-store-id` |
| `JWT_SECRET` | Secret key for signing JWT tokens. Critical for authentication security. MUST be a strong, unique value in production. | Server | `a-very-strong-random-secret-key` |

### How Environment Variables Are Loaded

- **Server-side**: Variables are loaded using `dotenv` in `server/index.ts` and accessed via `process.env.VARIABLE_NAME`
- **Client-side**: Variables are loaded by Vite (must be prefixed with `VITE_`) and accessed via the helper functions in `client/src/lib/env.ts`

### Notes

- Never commit `.env` files containing real secrets to version control
- Only variables prefixed with `VITE_` are exposed to the client-side code
- For local development, use `.env.local` for overrides specific to your machine

## Railway Deployment (Preferred Method)

### Prerequisites

1. A [Railway account](https://railway.app/)
2. [Railway CLI](https://docs.railway.app/develop/cli) installed (optional but recommended)
3. A PostgreSQL database
4. Stripe API keys (for payment processing)
5. MUX API keys (for video streaming)

### Railway Environment Variables

When deploying to Railway, you'll need to set the environment variables in your Railway project. You can do this through the Railway dashboard or using the CLI:

```bash
railway variables set DATABASE_URL=your_postgres_database_url STRIPE_SECRET_KEY=your_stripe_secret_key JWT_SECRET=your_production_jwt_secret ...
```

Make sure to set all the variables listed in the [Environment Variables](#environment-variables) section above.

### Deployment Steps

1. **Sign in to Railway**:
   ```bash
   railway login
   ```

2. **Initialize a new Railway project** (if not already done):
   ```bash
   railway init
   ```

3. **Link your local project to the Railway project**:
   ```bash
   railway link
   ```

4. **Add a PostgreSQL database to your project**:
   ```bash
   railway add
   ```
   Select PostgreSQL from the options.

5. **Set up environment variables**:
   ```bash
   railway variables set DATABASE_URL=<your-database-url> STRIPE_SECRET_KEY=<your-stripe-key> ...
   ```
   Or set them through the Railway dashboard.

6. **Deploy your application**:
   ```bash
   railway up
   ```

7. **Generate a domain**:
   ```bash
   railway domain
   ```

### Post-Deployment Configuration

1. **Set up Stripe webhooks** to point to your new domain
2. **Set up MUX webhooks** to point to your new domain
3. **Run database migrations**:
   ```bash
   railway run npm run db:push
   ```

## Developer Notes

### Admin User Setup

The script `server/setup-admin.ts` was originally designed for creating an admin user with the previous Appwrite authentication system. Due to the migration to a custom JWT-based email/password system, this script is **currently non-functional** as its Appwrite-specific components have been removed.

If you need to create an initial admin user, this script will require refactoring. You would typically:
1.  Define the admin user's email and a secure password (perhaps temporarily via environment variables for the script's run, or a more robust credentials management).
2.  Use the `storage.createUser` method from `server/storage.ts`.
3.  Ensure the password is hashed using the `hashPassword` utility from `server/auth.ts` before saving.
4.  Assign the 'admin' role to this user.

Please review and adapt `server/setup-admin.ts` to the new authentication system if this functionality is required.

## Vercel Deployment (Alternative)

### Prerequisites

1. A [Vercel account](https://vercel.com/)
2. [Vercel CLI](https://vercel.com/docs/cli) installed (optional)
3. A PostgreSQL database
4. Stripe and MUX API keys

### Deployment Steps

1. **Sign in to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy the application**:
   ```bash
   vercel
   ```

3. **Set environment variables** in the Vercel dashboard

4. **Connect a PostgreSQL database** in the Vercel dashboard or use an external provider

## Mobile App Preparation

### iOS App Store

1. Create an Apple Developer account ($99/year)
2. Create an App ID in the Apple Developer Portal
3. Create a distribution certificate and provisioning profile
4. Package the web app as a PWA or use a wrapper like Capacitor/Cordova
5. Submit for review in App Store Connect

### Google Play Store

1. Create a Google Play Developer account ($25 one-time fee)
2. Create a new application in the Google Play Console
3. Package the web app as a PWA or use a wrapper like Capacitor/Cordova
4. Generate a signed APK or Android App Bundle
5. Upload to the Google Play Console and submit for review

### Amazon App Store

1. Create an Amazon Developer account
2. Create a new app in the Amazon Developer Console
3. Package the web app similarly to Google Play
4. Upload and submit for review

## Troubleshooting

### Common Railway Deployment Issues

- **Database connection errors**: Ensure your DATABASE_URL is correct
- **Missing environment variables**: Check all required environment variables are set
- **Build failures**: Review build logs for specific errors
- **Runtime errors**: Check application logs via `railway logs`

### Resource Scaling

If you need to scale your application:

1. Adjust the number of replicas in the Railway dashboard
2. Upgrade your Railway plan for more resources
3. Scale your database as needed

## Monitoring and Maintenance

1. Set up monitoring with Railway's built-in tools
2. Consider integrating with external monitoring services
3. Regularly back up your database
4. Keep dependencies updated
