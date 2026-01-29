# Configuring Plugins

This guide explains how to configure installed plugins in Wiki.js.

## Overview

Most plugins require configuration after installation. Configuration is stored in the database and can be updated via the GraphQL API.

## Viewing Plugin Configuration

### Get Current Configuration

```graphql
query {
  plugins {
    single(id: "my-plugin") {
      id
      title
      config
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "plugins": {
      "single": {
        "id": "my-plugin",
        "title": "My Plugin",
        "config": {
          "enabled": true,
          "apiKey": "sk_****",
          "refreshInterval": 3600
        }
      }
    }
  }
}
```

### Get Configuration Schema

```graphql
query {
  plugins {
    single(id: "my-plugin") {
      configSchema
    }
  }
}
```

This returns the JSON Schema that defines available configuration options.

## Updating Configuration

### Update Plugin Config

```graphql
mutation {
  plugins {
    updateConfig(id: "my-plugin", config: {
      enabled: true,
      apiKey: "your-api-key-here",
      refreshInterval: 7200
    }) {
      responseResult {
        succeeded
        message
      }
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "plugins": {
      "updateConfig": {
        "responseResult": {
          "succeeded": true,
          "message": "Configuration updated successfully"
        }
      }
    }
  }
}
```

### Validation

Configuration is validated against the plugin's schema. Invalid configurations are rejected:

**Example Error**:
```json
{
  "errors": [{
    "message": "Configuration validation failed: refreshInterval must be >= 60"
  }]
}
```

## Common Configuration Patterns

### API Keys and Secrets

Many plugins require API keys for external services.

**Configuration**:
```graphql
mutation {
  plugins {
    updateConfig(id: "my-plugin", config: {
      apiKey: "sk_live_abc123",
      apiSecret: "secret_def456"
    }) {
      responseResult { succeeded }
    }
  }
}
```

**Security**: API keys are stored in the database. Ensure your database is secured and encrypted.

### URL Endpoints

Plugins that integrate with external services need URLs.

**Configuration**:
```graphql
mutation {
  plugins {
    updateConfig(id: "webhook-plugin", config: {
      webhookUrl: "https://hooks.example.com/webhook",
      apiUrl: "https://api.example.com"
    }) {
      responseResult { succeeded }
    }
  }
}
```

### Intervals and Timing

Plugins with periodic tasks need timing configuration.

**Configuration**:
```graphql
mutation {
  plugins {
    updateConfig(id: "sync-plugin", config: {
      syncInterval: 3600,      # seconds
      retryDelay: 300,         # seconds
      timeout: 30              # seconds
    }) {
      responseResult { succeeded }
    }
  }
}
```

### Feature Flags

Enable/disable plugin features.

**Configuration**:
```graphql
mutation {
  plugins {
    updateConfig(id: "my-plugin", config: {
      enabled: true,
      features: {
        notifications: true,
        analytics: false,
        autoSync: true
      }
    }) {
      responseResult { succeeded }
    }
  }
}
```

### Arrays and Lists

Some plugins accept lists of values.

**Configuration**:
```graphql
mutation {
  plugins {
    updateConfig(id: "filter-plugin", config: {
      allowedDomains: ["example.com", "trusted.org"],
      excludedPaths: ["/admin", "/api"],
      enabledFeatures: ["feature1", "feature2"]
    }) {
      responseResult { succeeded }
    }
  }
}
```

## Configuration Schema

Plugins define their configuration using JSON Schema.

### Example Schema

```yaml
# In plugin.yml
config:
  schema:
    type: object
    properties:
      apiKey:
        type: string
        title: API Key
        description: Your service API key
        format: password
      enabled:
        type: boolean
        title: Enable Plugin
        default: true
      refreshInterval:
        type: integer
        title: Refresh Interval (seconds)
        minimum: 60
        maximum: 86400
        default: 3600
    required:
      - apiKey
```

### Field Types

**String**:
```yaml
apiKey:
  type: string
  title: API Key
  format: password  # Masks input in UI
```

**Number**:
```yaml
refreshInterval:
  type: integer
  minimum: 60
  maximum: 3600
  default: 300
```

**Boolean**:
```yaml
enabled:
  type: boolean
  default: true
```

**Enum (Select)**:
```yaml
logLevel:
  type: string
  enum: [debug, info, warn, error]
  default: info
```

**Array**:
```yaml
allowedDomains:
  type: array
  items:
    type: string
  default: []
```

**Object**:
```yaml
features:
  type: object
  properties:
    notifications:
      type: boolean
    analytics:
      type: boolean
```

## Applying Configuration Changes

### Automatic Application

Most configuration changes take effect immediately without restart.

### Restart Required

Some plugins may require restart if they:
- Have GraphQL extensions
- Need to reinitialize connections
- Have specific requirements

Check the plugin's documentation.

### Reactivate Plugin

If configuration doesn't apply, try reactivating:

```graphql
# Deactivate
mutation {
  plugins {
    deactivate(id: "my-plugin") {
      responseResult { succeeded }
    }
  }
}

# Activate
mutation {
  plugins {
    activate(id: "my-plugin") {
      responseResult { succeeded }
      requiresRestart
    }
  }
}
```

## Configuration Examples

### Example 1: Webhook Plugin

```graphql
mutation {
  plugins {
    updateConfig(id: "webhook-notifier", config: {
      webhookUrl: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      events: ["page:save", "user:login"],
      enabled: true,
      includeDetails: true
    }) {
      responseResult { succeeded }
    }
  }
}
```

### Example 2: Analytics Plugin

```graphql
mutation {
  plugins {
    updateConfig(id: "analytics", config: {
      trackingId: "UA-XXXXX-Y",
      anonymizeIp: true,
      trackPageViews: true,
      trackEvents: false
    }) {
      responseResult { succeeded }
    }
  }
}
```

### Example 3: Sync Plugin

```graphql
mutation {
  plugins {
    updateConfig(id: "external-sync", config: {
      apiUrl: "https://api.example.com",
      apiKey: "your-key-here",
      syncInterval: 3600,
      syncOnSave: true,
      retryOnError: true,
      maxRetries: 3
    }) {
      responseResult { succeeded }
    }
  }
}
```

## Troubleshooting Configuration

### Validation Errors

**Problem**: Configuration rejected with validation error.

**Solutions**:
1. Check required fields are provided
2. Verify types match schema (string, number, boolean)
3. Ensure values are within min/max ranges
4. Check enum values match allowed options

### Configuration Not Applied

**Problem**: Changes saved but plugin still uses old config.

**Solutions**:
1. Reactivate the plugin
2. Restart Wiki.js server
3. Check plugin logs for errors
4. Verify plugin reads config correctly

### Missing Configuration Options

**Problem**: Expected configuration option not available.

**Solutions**:
1. Check plugin version (older versions may have fewer options)
2. Review plugin documentation
3. Update plugin to latest version

## Security Best Practices

### API Keys

- **Never commit** API keys to version control
- **Rotate regularly**: Change API keys periodically
- **Use read-only keys** when possible
- **Monitor usage**: Check for unauthorized API usage

### Webhooks

- **Verify signatures**: If the service provides webhook signatures, enable verification
- **Use HTTPS**: Always use HTTPS URLs for webhooks
- **Restrict IPs**: If possible, restrict incoming webhook IPs

### Data Storage

- **Encrypt sensitive data**: Ensure database encryption is enabled
- **Backup configuration**: Include plugin config in backups
- **Limit access**: Only admins should configure plugins

## Configuration Backup

### Export Configuration

```graphql
query {
  plugins {
    list {
      id
      config
    }
  }
}
```

Save the response to backup plugin configurations.

### Import Configuration

After reinstalling or migrating:

```graphql
mutation {
  plugins {
    updateConfig(id: "plugin-id", config: {
      # Paste backed up config here
    }) {
      responseResult { succeeded }
    }
  }
}
```

## Next Steps

- [Troubleshooting Plugins](./troubleshooting.md)
- [Security Guide](./security.md)
- [Installation Guide](./installation.md)

## Related Documentation

- [Plugin Installation](./installation.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Security Guide](./security.md)
