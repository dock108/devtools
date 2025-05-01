# CronDeck Authentication Flow

This document describes the authentication flow used in the CronDeck application.

## Authentication Flow Diagram

```mermaid
flowchart TD
    A[User Visits /dashboard] --> B{Authenticated?}
    B -- No --> C[Redirect to /login]
    B -- Yes --> D[Show Dashboard]
    
    C --> E[User Enters Email/Password]
    E --> F[Submit Credentials]
    F --> G{Auth Success?}
    
    G -- No --> H[Show Error]
    H --> E
    
    G -- Yes --> I[Create Session]
    I --> J[Redirect to /auth/callback]
    J --> K[Set Auth Cookies]
    K --> L[Redirect to /dashboard]
    L --> D
    
    D --> M[User Clicks Logout]
    M --> N[Delete Session]
    N --> O[Redirect to Landing Page]
    
    subgraph "Protected Routes"
    P[/dashboard/*]
    Q[/settings/*]
    end
    
    subgraph "Auth Middleware"
    R[Check Auth Token]
    S[Redirect if No Token]
    end
    
    P --> R
    Q --> R
    R --> S
```

## Authentication Details

### Tech Stack
- **Authentication Provider**: Supabase Auth
- **Storage**: Supabase PostgreSQL database
- **Client Library**: @supabase/auth-helpers-nextjs

### Key Components

1. **Middleware**: Checks for authenticated sessions on protected routes
2. **Auth Callback Handler**: Processes authentication redirects and sets up sessions
3. **Server-Side Auth Checks**: Verifies authentication status on protected pages
4. **Protected Layout**: Wraps dashboard and settings pages with authentication checks

### User Flow

1. User attempts to access a protected route (e.g., `/dashboard`)
2. If not authenticated, user is redirected to login page
3. User enters email/password credentials
4. On successful authentication, user is redirected to `/auth/callback`
5. Auth callback sets up the session and redirects to the originally requested page
6. User can log out, which clears the session and redirects to the landing page

### Database Tables

- **users**: Stores user information and plan tiers
- **jobs**: Cron job metadata with Row Level Security (RLS) policies 