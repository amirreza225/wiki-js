# Installing Plugins

This guide explains how administrators can install plugins on their Wiki.js instance.

## Prerequisites

- Admin access to Wiki.js
- Access to GraphQL API at `/graphql`
- Plugin ZIP file

## Installation Methods

### Method 1: Upload ZIP File (Recommended)

#### Step 1: Obtain Plugin ZIP File

Obtain the plugin ZIP file from one of these sources:
- Download from plugin author's GitHub releases
- Receive from plugin developer
- Download from trusted third-party source

**Security Note**: Only install plugins from trusted sources. Review the plugin code before installation if possible.

#### Step 2: Access GraphQL Playground

1. Navigate to your Wiki.js instance
2. Go to `https://your-wiki.com/graphql`
3. Log in with your admin credentials

#### Step 3: Upload Plugin

Use the GraphQL upload mutation:

```graphql
mutation InstallPlugin($file: Upload!) {
  plugins {
    install(file: $file) {
      responseResult {
        succeeded
        message
      }
      plugin {
        id
        title
        version
        status
      }
    }
  }
}
```

**Steps**:
1. Paste the mutation above into the GraphQL Playground
2. In the "Query Variables" section at the bottom, click "Add Variable"
3. Select your plugin ZIP file
4. Click "Execute Query" button

**Expected Response**:
```json
{
  "data": {
    "plugins": {
      "install": {
        "responseResult": {
          "succeeded": true,
          "message": "Plugin installed successfully"
        },
        "plugin": {
          "id": "my-plugin",
          "title": "My Plugin",
          "version": "1.0.0",
          "status": "installed"
        }
      }
    }
  }
}
```

#### Step 4: Activate Plugin

After installation, activate the plugin:

```graphql
mutation {
  plugins {
    activate(id: "my-plugin") {
      responseResult {
        succeeded
        message
      }
      requiresRestart
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "plugins": {
      "activate": {
        "responseResult": {
          "succeeded": true,
          "message": "Plugin activated successfully"
        },
        "requiresRestart": false
      }
    }
  }
}
```

#### Step 5: Restart Server (if required)

If `requiresRestart: true`, restart the Wiki.js server:

**Using systemd**:
```bash
sudo systemctl restart wikijs
```

**Using PM2**:
```bash
pm2 restart wikijs
```

**Using Docker**:
```bash
docker restart wikijs
```

**Manual**:
```bash
# Stop the server (Ctrl+C or kill process)
# Then start again
node server
```

### Method 2: Manual Installation

For servers where you have direct file system access.

#### Step 1: Extract Plugin

```bash
# Copy ZIP to server
scp plugin.zip user@server:/tmp/

# SSH to server
ssh user@server

# Extract to plugins directory
cd /path/to/wikijs
unzip /tmp/plugin.zip -d plugins/installed/plugin-name
```

#### Step 2: Install Dependencies

If the plugin has a `package.json`:

```bash
cd plugins/installed/plugin-name
npm install --production
```

#### Step 3: Restart Wiki.js

```bash
sudo systemctl restart wikijs
```

#### Step 4: Refresh Plugin List

Use GraphQL to refresh the plugin list:

```graphql
mutation {
  plugins {
    refreshFromDisk {
      responseResult {
        succeeded
        message
      }
    }
  }
}
```

#### Step 5: Activate Plugin

Use the activation mutation from Method 1, Step 4.

## Verifying Installation

### Check Plugin List

List all installed plugins:

```graphql
query {
  plugins {
    list {
      id
      title
      version
      isEnabled
      status
      description
      author
    }
  }
}
```

You should see your newly installed plugin in the list.

### Check Plugin Status

Get details for a specific plugin:

```graphql
query {
  plugins {
    single(id: "my-plugin") {
      id
      title
      version
      isEnabled
      status
      config
      permissions
    }
  }
}
```

### View Logs

Check server logs for plugin messages:

```bash
# Using journalctl (systemd)
sudo journalctl -u wikijs -f

# Using PM2
pm2 logs wikijs

# Using Docker
docker logs -f wikijs
```

Look for messages like:
```
[MASTER] info: [Plugin:my-plugin] Plugin initialized
[MASTER] info: [Plugin:my-plugin] Plugin activated
```

## Troubleshooting

### Plugin Not Appearing in List

**Problem**: Plugin doesn't show up after installation.

**Solutions**:
1. Verify ZIP file was extracted correctly:
   ```bash
   ls -la plugins/installed/
   ```

2. Check for `plugin.yml` or `plugin.json`:
   ```bash
   cat plugins/installed/plugin-name/plugin.yml
   ```

3. Restart Wiki.js:
   ```bash
   sudo systemctl restart wikijs
   ```

4. Use refresh mutation:
   ```graphql
   mutation {
     plugins {
       refreshFromDisk {
         responseResult {
           succeeded
           message
         }
       }
     }
   }
   ```

### Installation Fails with "Invalid Manifest"

**Problem**: Installation fails with validation error.

**Solutions**:
1. Verify `plugin.yml` syntax:
   ```bash
   yamllint plugins/installed/plugin-name/plugin.yml
   ```

2. Check required fields are present:
   - `id`
   - `title`
   - `version`
   - `author`
   - `license`

3. Contact plugin author for updated version

### Installation Fails with "Incompatible Version"

**Problem**: Plugin requires different Wiki.js version.

**Solutions**:
1. Check your Wiki.js version:
   ```graphql
   query {
     system {
       info {
         version
       }
     }
   }
   ```

2. Check plugin compatibility in manifest:
   ```yaml
   compatibility:
     wikijs: ">=2.5.0"
   ```

3. Update Wiki.js or find compatible plugin version

### Plugin Won't Activate

**Problem**: Activation fails or plugin shows "errored" status.

**Solutions**:
1. Check plugin errors:
   ```graphql
   query {
     plugins {
       errors(pluginId: "my-plugin") {
         errorType
         message
         stack
         createdAt
       }
     }
   }
   ```

2. Check for missing dependencies:
   ```bash
   cd plugins/installed/plugin-name
   npm install
   ```

3. Check server logs for detailed error messages

4. Verify permissions are valid:
   ```graphql
   query {
     plugins {
       single(id: "my-plugin") {
         permissions
       }
     }
   }
   ```

### Permission Denied Errors

**Problem**: Plugin fails with permission errors.

**Solutions**:
1. Check file permissions:
   ```bash
   ls -la plugins/installed/plugin-name
   chown -R wikijs:wikijs plugins/installed/plugin-name
   ```

2. Check database permissions (for plugins with migrations):
   ```sql
   SHOW GRANTS FOR 'wikijs_user'@'localhost';
   ```

3. Ensure Wiki.js has write access to plugin data directory:
   ```bash
   chmod -R 755 plugins/data/
   ```

## Security Best Practices

### Before Installing

1. **Review Source Code**: If possible, review the plugin code before installation
2. **Check Author**: Only install plugins from trusted sources
3. **Check Permissions**: Review requested permissions in manifest
4. **Verify Signature**: If the plugin is signed, verify the signature (future feature)

### After Installing

1. **Monitor Logs**: Watch for suspicious activity in logs
2. **Review Errors**: Check plugin error logs regularly
3. **Keep Updated**: Update plugins when new versions are released
4. **Backup First**: Always backup before installing new plugins

## Configuration

After activation, most plugins require configuration. See [Configuration Guide](./configuration.md).

## Next Steps

- [Configure Your Plugin](./configuration.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Security Guide](./security.md)

## Related Documentation

- [Plugin Configuration](./configuration.md)
- [Troubleshooting Plugins](./troubleshooting.md)
- [Plugin Security](./security.md)
