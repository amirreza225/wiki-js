# Approval Workflow Plugin

A comprehensive Wiki.js plugin that adds approval workflow functionality for page changes.

## Features

- ✅ **Database Models** - Objection.js models for approvals and settings
- ✅ **API Routes** - REST endpoints at `/api/plugin/approval-workflow/*`
- ✅ **GraphQL API** - Query and mutation support for approvals
- ✅ **Lifecycle Hooks** - Automatically creates approval requests on page save
- ✅ **Vue Components** - ApprovalBadge component with live stats
- ✅ **Admin Page** - Full approval management interface
- ✅ **UI Injection** - Badge shows in page toolbar
- ✅ **Vuex Store** - Centralized state management
- ✅ **Configurable** - Extensive configuration options

## Installation

### 1. Install the Plugin

Copy the `approval-workflow` directory to `plugins/installed/`:

```bash
cp -r approval-workflow /path/to/wiki-js/plugins/installed/
```

### 2. Run Database Migrations

The plugin will automatically run migrations on activation to create these tables:
- `plugin_approval-workflow_requests` - Stores approval requests
- `plugin_approval-workflow_settings` - Stores path-specific settings

### 3. Build Plugin Assets

```bash
cd /path/to/wiki-js
node dev/webpack/webpack.plugin.config.js
```

### 4. Build Main Application

```bash
yarn build
```

### 5. Activate Plugin

1. Go to Admin > Extensions in Wiki.js
2. Find "Approval Workflow" plugin
3. Click "Install" (if showing ZIP upload)
4. Click "Activate"
5. Configure settings

## Configuration

Available configuration options:

- **Enable Approval Workflow** - Master on/off switch
- **Require Approval for New Pages** - New pages need approval
- **Require Approval for Page Edits** - Edits need approval
- **Auto-Approve Admin Changes** - Bypass approval for admins
- **Notify Approvers** - Send email notifications (placeholder)
- **Approver Email Addresses** - Comma-separated list of approver emails

## Usage

### For Content Editors

1. Create or edit a page as normal
2. Save the page
3. An approval request is automatically created (if enabled)
4. Wait for approval notification
5. Page will be published after approval

### For Approvers

1. Click the approval badge in the page toolbar (shows pending count)
2. Or go to Admin > Plugins > Approval Requests
3. Review pending requests
4. Click "Approve" or "Reject" with optional notes
5. Request status is updated immediately

### API Endpoints

#### Get All Approvals
```bash
GET /api/plugin/approval-workflow/approvals?status=pending&limit=50&offset=0
```

#### Get Specific Approval
```bash
GET /api/plugin/approval-workflow/approvals/:id
```

#### Approve Request
```bash
POST /api/plugin/approval-workflow/approvals/:id/approve
Content-Type: application/json

{
  "userId": 1,
  "userName": "Administrator",
  "notes": "Looks good!"
}
```

#### Reject Request
```bash
POST /api/plugin/approval-workflow/approvals/:id/reject
Content-Type: application/json

{
  "userId": 1,
  "userName": "Administrator",
  "notes": "Needs revision"
}
```

#### Get Statistics
```bash
GET /api/plugin/approval-workflow/stats
```

### GraphQL Queries

```graphql
query {
  approvalRequests(status: pending, limit: 10) {
    approvals {
      id
      pageTitle
      requesterName
      status
      requestedAt
    }
    total
  }
}

query {
  approvalStats {
    pending
    approved
    rejected
    total
  }
}
```

### GraphQL Mutations

```graphql
mutation {
  approveRequest(id: 1, notes: "Approved!") {
    responseResult {
      succeeded
      message
    }
    approval {
      id
      status
      approverName
    }
  }
}

mutation {
  rejectRequest(id: 2, notes: "Please revise") {
    responseResult {
      succeeded
      message
    }
    approval {
      id
      status
      approverName
    }
  }
}
```

## Architecture

### Server-Side

```
server/
├── index.js                  # Main entry point with lifecycle methods
├── models/
│   ├── Approval.js          # Approval request model
│   └── ApprovalSetting.js   # Settings model
├── routes/
│   └── index.js             # REST API endpoints
└── hooks/
    └── pageSave.js          # Hook that creates approval requests
```

### Client-Side

```
client/
├── index.js                  # Client entry point
├── components/
│   └── ApprovalBadge.vue    # Toolbar badge component
├── pages/
│   └── AdminApprovals.vue   # Admin management page
└── store/
    └── approval.js          # Vuex store module
```

### GraphQL

```
graphql/
├── schema.graphql           # Type definitions
└── resolvers.js             # Query and mutation resolvers
```

## Database Schema

### plugin_approval-workflow_requests

- `id` - Primary key
- `pageId` - Page being changed
- `pagePath` - Page path
- `pageTitle` - Page title
- `requesterId` - User who made the change
- `requesterName` - User name
- `requesterEmail` - User email
- `approverId` - User who approved/rejected
- `approverName` - Approver name
- `status` - pending/approved/rejected
- `isNew` - Is this a new page?
- `changeDescription` - Description of change
- `approverNotes` - Notes from approver
- `requestedAt` - When requested
- `reviewedAt` - When reviewed

### plugin_approval-workflow_settings

- `id` - Primary key
- `pathPattern` - Path pattern (supports wildcards)
- `locale` - Locale code
- `requireApproval` - Require approval for this path?
- `autoApprove` - Auto-approve for this path?
- `approverUserIds` - List of approver user IDs
- `approverGroupIds` - List of approver group IDs

## Development

### Running in Development

```bash
# Watch for changes
yarn dev

# Build plugin assets
node dev/webpack/webpack.plugin.config.js
```

### Testing

```bash
# Run tests
yarn test

# Test specific hook
node -e "require('./server/hooks/pageSave')({ page: { id: 1, title: 'Test' }, user: { id: 1, name: 'Test' }, isNew: true }, console)"
```

## Troubleshooting

### Plugin Not Appearing

1. Check that `plugin.yml` exists and is valid YAML
2. Restart Wiki.js server
3. Check logs for errors

### Components Not Showing

1. Run `yarn build` to compile Vue components
2. Clear browser cache
3. Check webpack output for errors

### Database Errors

1. Check that migrations ran successfully
2. Verify table names start with `plugin_approval-workflow_`
3. Check database logs

### API Errors

1. Check that plugin is activated
2. Verify routes are registered: `WIKI.plugins.routeLoader.hasPluginRoutes('approval-workflow')`
3. Check server logs

## License

MIT

## Author

Wiki.js

## Support

For issues and questions, visit https://github.com/requarks/wiki-plugins
