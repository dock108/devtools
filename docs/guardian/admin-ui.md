# Guardian Admin UI

The Guardian Admin UI provides a set of pages and components for managing rule sets, notification channels, and connected accounts. This document outlines the structure, functionality, and setup of the Admin UI.

## Access Control

The Admin UI is protected by role-based access control. Only users with the `admin` role in their JWT claims can access the admin pages. This is enforced in the `app/admin/layout.tsx` component.

To grant admin access to a user:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"admin"')
WHERE email = 'admin@example.com';
```

## Row Level Security (RLS)

The Admin UI enforces permissions through Row Level Security policies in Supabase. The SQL for these policies is located in `supabase/migrations/20250426_admin_rls.sql`. Make sure to execute this SQL after deploying the application.

## Pages and Components

### Dashboard (`/admin`)

- **File**: `app/admin/page.tsx`
- **Purpose**: Provides an overview of the application with metrics and quick links.
- **Components**:
  - `MetricCard`: Displays key metrics such as connected accounts count, rule sets count, alerts count, and active backfills.
  - Cards for quick actions and admin resources.

### Notification Channels (`/admin/notification-channels`)

- **File**: `app/admin/notification-channels/page.tsx`
- **Purpose**: Allows administrators to manage notification channels for alerts.
- **Key Components**:
  - `CreateNotificationChannel`: Dialog component for creating new notification channels.
  - `NotificationChannelActions`: Dropdown menu with actions for each channel (delete).

### Rule Sets (`/admin/rulesets`)

- **File**: `app/admin/rulesets/page.tsx`
- **Purpose**: Displays a list of rule sets with their details.
- **Sub-Pages**:
  - **Create** (`/admin/rulesets/create`): Form for creating new rule sets.
  - **View** (`/admin/rulesets/[id]`): Detailed view of a rule set.
  - **Edit** (`/admin/rulesets/[id]/edit`): Form for editing an existing rule set.

### Connected Accounts (`/admin/accounts`)

- **File**: `app/admin/accounts/page.tsx`
- **Purpose**: Displays a list of connected Stripe accounts.
- **Sub-Pages**:
  - **Settings** (`/admin/accounts/[id]/settings`): Form for managing account settings.

## Data Models

### Notification Channels

```
notification_channels
├── id: string (UUID)
├── name: string
├── type: string ('slack', 'email')
├── destination: string
└── created_at: timestamp
```

### Rule Sets

```
rule_sets
├── id: string (UUID)
├── name: string
├── description: string (optional)
├── is_active: boolean
├── rules_config: jsonb
├── created_at: timestamp
└── updated_at: timestamp
```

### Accounts

```
accounts
├── id: string (UUID)
├── stripe_id: string
├── display_name: string
├── is_active: boolean
├── rule_set_id: string (UUID, optional)
└── created_at: timestamp
```

## Component Dependencies

The Admin UI uses several shared UI components from the `@/components/ui` directory:

- `Button`: Used for actions and navigation.
- `Card`: Container for content sections.
- `Table`: Displays lists of items.
- `Form`: Form components for data input.
- `Dialog`: Modal dialogs for actions like creating new items.
- `Select`: Dropdown selectors for options.
- `Badge`: Visual indicators for status.

## API Interactions

All data interactions are handled through the Supabase client:

1. **Server Components**: Use `createServerClient` from `@supabase/ssr`.
2. **Client Components**: Use `createClientComponentClient` from `@supabase/auth-helpers-nextjs`.

Example server component query:

```typescript
const supabase = createServerClient<Database>({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  cookies: {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
  },
});

const { data, error } = await supabase
  .from('notification_channels')
  .select('*')
  .order('created_at', { ascending: false });
```

Example client component mutation:

```typescript
const supabase = createClientComponentClient<Database>();

const { error } = await supabase
  .from('rule_sets')
  .update({
    name: values.name,
    description: values.description || null,
    is_active: values.is_active,
    rules_config: rulesConfig,
  })
  .eq('id', params.id);
```

## Error Handling

The Admin UI implements consistent error handling:

1. **Server errors**: Caught and thrown with descriptive messages.
2. **Client errors**: Managed with state (`error` state variable), displayed to the user, and logged to the console.
3. **Form validation**: Using Zod schemas with form errors displayed inline.
4. **Toast notifications**: For success/error feedback after actions.

## Testing

Unit tests for components are located in the `tests/admin` directory. Tests use React Testing Library and Jest.

Example test for a component:

```typescript
describe('NotificationChannelActions', () => {
  test('renders the action button', () => {
    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

## Future Improvements

1. **Batch Operations**: Add support for bulk actions on items.
2. **Audit Logs**: Track admin actions in an audit log table.
3. **Role Management**: Allow creating and assigning different admin roles.
4. **Search & Filtering**: Add search and advanced filtering to the lists.
5. **Real-time Updates**: Implement Supabase real-time subscriptions for live updates to the UI.
