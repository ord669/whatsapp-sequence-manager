# WhatsApp Sequence Manager

A comprehensive platform to manage WhatsApp marketing sequences with automated messaging campaigns.

## Features

- 📱 **Multi-Account Support**: Connect multiple WhatsApp Business accounts
- 📝 **Template Management**: Create and manage WhatsApp message templates
- 🔄 **Visual Sequence Builder**: Build automated message sequences with a flowchart interface
- 📊 **Version Control**: Track and compare different versions of your sequences
- ⏰ **Smart Scheduling**: Business hours awareness with flexible delay options (minutes, hours, days)
- 👥 **Contact Management**: Organize and track your contacts
- 📈 **Analytics**: Monitor sequence performance and message delivery

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- WhatsApp Business API credentials from Meta

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd whatsapp-sequence-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Update your `.env` file with your database connection:
```
DATABASE_URL="postgresql://user:password@localhost:5432/whatsapp_sequence_manager"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WEBHOOK_VERIFY_TOKEN="your-webhook-verify-token"
CHATWOOT_BASE_URL="https://cw.i3c.uk"
CHATWOOT_ACCOUNT_ID="123" # Optional fallback when no Meta account is linked
CHATWOOT_API_ACCESS_TOKEN="abc123" # Required if ACCOUNT_ID is set
CHATWOOT_ACCOUNT_LABEL="Default Chatwoot" # Optional display label
CHATWOOT_ACCOUNT_PHONE="+15551234567" # Optional phone label
LOG_LEVEL="debug" # Optional: debug, info, warn, error, ...
LOG_SERVICE_NAME="whatsapp-sequence-manager"
```

5. Generate Prisma client and push the schema to your database:
```bash
npm run db:generate
npm run db:push
```

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Meta/WhatsApp API Setup

To use this application, you need:

1. **Facebook Business Manager Account**
2. **WhatsApp Business Account (WABA)**
3. **Meta App** with WhatsApp Business API access
4. **System User Access Token** with the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

### Getting Your Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create or select your app
3. Add WhatsApp product to your app
4. Note down:
   - App ID
   - App Secret
   - WABA ID
   - Phone Number ID
   - System User Access Token

## Project Structure

```
/whatsapp-sequence-manager
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js app directory
│   │   ├── api/              # API routes
│   │   ├── dashboard/        # Dashboard pages
│   │   ├── meta-accounts/    # Meta account management
│   │   ├── contacts/         # Contact management
│   │   ├── templates/        # Template management
│   │   ├── sequences/        # Sequence builder
│   │   └── settings/         # Settings
│   ├── components/           # React components
│   │   ├── ui/              # UI components (shadcn/ui)
│   │   ├── layout/          # Layout components
│   │   └── ...
│   └── lib/                 # Utility functions
│       ├── prisma.ts        # Prisma client
│       ├── meta-api.ts      # Meta API wrapper
│       ├── logger.ts        # Structured logger
│       └── business-hours.ts # Scheduling logic
├── jobs/
│   └── message-scheduler.ts  # Background job for sending messages
└── package.json
```

## Logging & Observability

- Structured logging is handled by [Pino](https://github.com/pinojs/pino) via `src/lib/logger.ts`.
- Logs automatically include the `service` and `environment` fields so they can be forwarded to any aggregation platform.
- Configure verbosity with `LOG_LEVEL` (defaults to `debug` locally, `info` in production) and optionally override the service name with `LOG_SERVICE_NAME`.
- Development mode pretty-prints logs for readability, while production emits JSON for ingestion by CloudWatch, Loki, Datadog, etc.
- Server code and jobs should import `logger`/`createLogger`/`toError` from `@/lib/logger` instead of using `console`.

## Usage

### 1. Connect Your Meta Account

1. Navigate to "Meta Accounts"
2. Click "Connect Account"
3. Fill in your credentials (Meta + optional Chatwoot Account ID, Inbox ID, and API access token if you want to route sends through Chatwoot)
4. Click "Verify Connection"
5. Save the account

### 2. Create Message Templates

1. Go to "Templates"
2. Click "Create Template"
3. Design your template with variables ({{1}}, {{2}}, etc.)
4. Submit to Meta for approval
5. Wait for approval (usually within 24 hours)

### 3. Add Contacts

1. Go to "Contacts"
2. Add contacts manually or import from CSV
3. Include phone number, first name, and last name

### 4. Build a Sequence

1. Navigate to "Sequences"
2. Click "Create Sequence"
3. Use the visual flowchart builder to:
   - Add message nodes
   - Add delay nodes (minutes, hours, or days)
   - Connect nodes to create a flow
4. Save and activate the sequence

### 5. Subscribe Contacts

1. Select a sequence
2. Subscribe contacts via the UI or API
3. Monitor progress in real-time on the flowchart

## API Endpoints

### Meta Accounts
- `GET /api/meta-accounts` - List accounts
- `POST /api/meta-accounts` - Create account
- `POST /api/meta-accounts/verify` - Verify credentials
- `PATCH /api/meta-accounts/[id]` - Update account
- `POST /api/meta-accounts/[id]/test` - Test connection

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/[id]` - Get contact
- `PUT /api/contacts/[id]` - Update contact
- `DELETE /api/contacts/[id]` - Delete contact

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/[id]` - Get template
- `PUT /api/templates/[id]` - Update template
- `DELETE /api/templates/[id]` - Delete template

### Sequences
- `GET /api/sequences` - List sequences
- `POST /api/sequences` - Create sequence
- `GET /api/sequences/[id]` - Get sequence
- `PUT /api/sequences/[id]` - Update sequence
- `DELETE /api/sequences/[id]` - Delete sequence

### Subscriptions
- `GET /api/subscriptions` - List subscriptions
- `POST /api/subscriptions` - Subscribe contact
- `PUT /api/subscriptions/[id]/pause` - Pause subscription
- `PUT /api/subscriptions/[id]/resume` - Resume subscription
- `DELETE /api/subscriptions/[id]` - Cancel subscription

## Background Jobs

The message scheduler runs as a background job to send messages at the right time.

To start the scheduler:
```bash
npm run scheduler
```

For production, use a process manager like PM2:
```bash
pm2 start npm --name "wa-scheduler" -- run scheduler
```

## Development

```bash
# Run development server
npm run dev

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Open Prisma Studio
npm run db:studio

# Build for production
npm run build

# Start production server
npm start
```

### Local dev server rules

Before starting `npm run dev`, make sure port 3000 is free:

1. Run `lsof -ti tcp:3000` to check for any existing process.
2. If a PID is returned, kill it (`kill <pid>`).
3. Only then run `npm run dev`, so the app always binds to `http://localhost:3000`.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **UI**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Flowchart**: React Flow
- **Scheduling**: node-cron

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

