# Troubleshooting Plugins

This guide helps administrators diagnose and resolve common plugin issues.

## Checking Plugin Status

### View All Plugins

```graphql
query {
  plugins {
    list {
      id
      title
      version
      isEnabled
      status
    }
  }
}
```

**Status Values**:
- `installed` - Plugin installed but not activated
- `active` - Plugin is running normally
- `errored` - Plugin encountered an error

### View Plugin Errors

```graphql
query {
  plugins {
    errors(pluginId: "my-plugin") {
      id
      errorType
      message
      stack
      context
      createdAt
    }
  }
}
```

## Common Issues

### Plugin Won't Install

#### Issue: "Invalid ZIP file"

**Symptoms**:
- Installation fails immediately
- Error mentions ZIP format

**Solutions**:
1. Verify ZIP file integrity:
   ```bash
   unzip -t plugin.zip
   ```

2. Re-download plugin ZIP
3. Ensure ZIP is not corrupted during transfer

#### Issue: "Invalid manifest"

**Symptoms**:
- Installation fails with validation error
- Error mentions plugin.yml or plugin.json

**Solutions**:
1. Check manifest file exists:
   ```bash
   unzip -l plugin.zip | grep plugin.yml
   ```

2. Validate YAML syntax:
   ```bash
   yamllint plugin.yml
   ```

3. Verify required fields:
   - `id`
   - `title`
   - `version`
   - `author`
   - `license`

#### Issue: "Incompatible version"

**Symptoms**:
- Installation fails with compatibility error
- Error mentions Wiki.js version

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

2. Check plugin compatibility in `plugin.yml`:
   ```yaml
   compatibility:
     wikijs: ">=2.5.0"
   ```

3. Options:
   - Update Wiki.js to meet requirements
   - Find compatible plugin version
   - Contact plugin author

### Plugin Won't Activate

#### Issue: Missing Dependencies

**Symptoms**:
- Activation fails
- Error: "Cannot find module 'xxx'"

**Solutions**:
1. SSH to server:
   ```bash
   cd /path/to/wikijs/plugins/installed/plugin-name
   ```

2. Install dependencies:
   ```bash
   npm install --production
   ```

3. Retry activation

#### Issue: Database Migration Failed

**Symptoms**:
- Activation fails
- Error mentions migration or database

**Solutions**:
1. Check database permissions:
   ```sql
   SHOW GRANTS FOR 'wikijs_user'@'localhost';
   ```

2. Ensure user has CREATE TABLE permission:
   ```sql
   GRANT CREATE ON wikijs_db.* TO 'wikijs_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. Check migration file syntax:
   ```bash
   cat plugins/installed/plugin-name/migrations/*.js
   ```

4. View detailed error in logs:
   ```bash
   journalctl -u wikijs -n 100
   ```

#### Issue: Permission Errors

**Symptoms**:
- Activation fails
- Error: "Permission denied"

**Solutions**:
1. Check file permissions:
   ```bash
   ls -la plugins/installed/plugin-name/
   ```

2. Fix ownership:
   ```bash
   sudo chown -R wikijs:wikijs plugins/installed/plugin-name
   ```

3. Fix permissions:
   ```bash
   sudo chmod -R 755 plugins/installed/plugin-name
   ```

### Plugin Shows "Errored" Status

#### Issue: Plugin Crashed on Activation

**Symptoms**:
- Plugin status shows "errored"
- No clear error message

**Solutions**:
1. Check plugin error log:
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

2. Check server logs:
   ```bash
   journalctl -u wikijs -f
   ```

3. Common causes:
   - Invalid configuration
   - Missing API keys
   - Network connectivity issues
   - External service down

4. Try reconfiguring:
   ```graphql
   mutation {
     plugins {
       updateConfig(id: "my-plugin", config: {
         # Updated config
       }) {
         responseResult { succeeded }
       }
     }
   }
   ```

5. Deactivate and reactivate:
   ```graphql
   mutation {
     plugins {
       deactivate(id: "my-plugin") {
         responseResult { succeeded }
       }
     }
   }
   
   mutation {
     plugins {
       activate(id: "my-plugin") {
         responseResult { succeeded }
       }
     }
   }
   ```

#### Issue: Plugin Errors Intermittently

**Symptoms**:
- Plugin sometimes works, sometimes errors
- Errors appear randomly

**Solutions**:
1. Check for rate limiting:
   - External API rate limits
   - Database connection limits

2. Check for resource constraints:
   ```bash
   # Memory usage
   free -h
   
   # CPU usage
   top
   
   # Disk space
   df -h
   ```

3. Review plugin logs for patterns
4. Contact plugin author with error details

### Plugin Not Working as Expected

#### Issue: Hooks Not Firing

**Symptoms**:
- Plugin activated but no actions occur
- Expected events not happening

**Solutions**:
1. Verify plugin is activated (not just installed):
   ```graphql
   query {
     plugins {
       single(id: "my-plugin") {
         isEnabled
         status
       }
     }
   }
   ```

2. Check hook registration in logs:
   ```bash
   journalctl -u wikijs | grep "Registering hook"
   ```

3. Verify hook names match exactly (case-sensitive)

4. Test by triggering the event:
   - For `page:save`: Edit and save a page
   - For `user:login`: Log out and log in

5. Check plugin logs:
   ```bash
   journalctl -u wikijs | grep "Plugin:my-plugin"
   ```

#### Issue: Configuration Not Applied

**Symptoms**:
- Configuration saved but plugin ignores it
- Old behavior persists

**Solutions**:
1. Deactivate and reactivate plugin
2. Restart Wiki.js:
   ```bash
   sudo systemctl restart wikijs
   ```

3. Verify config is saved:
   ```graphql
   query {
     plugins {
       single(id: "my-plugin") {
         config
       }
     }
   }
   ```

4. Check if plugin requires specific config format

### Performance Issues

#### Issue: Slow Page Loads

**Symptoms**:
- Pages load slowly after plugin installed
- Increased response times

**Solutions**:
1. Identify culprit plugin:
   - Deactivate plugins one by one
   - Test page load after each deactivation

2. Check plugin logs for long-running operations

3. Review plugin hooks:
   - Hooks should complete in < 100ms
   - Slow hooks block page operations

4. Contact plugin author about performance

#### Issue: High Memory Usage

**Symptoms**:
- Wiki.js memory usage increased
- Out of memory errors

**Solutions**:
1. Monitor memory:
   ```bash
   ps aux | grep node
   ```

2. Identify memory-heavy plugins:
   - Deactivate plugins and monitor memory

3. Check for memory leaks:
   - Plugin not cleaning up resources
   - Event listeners not removed

4. Restart Wiki.js periodically

## Diagnostic Commands

### Server Logs

**systemd**:
```bash
# View recent logs
journalctl -u wikijs -n 100

# Follow logs in real-time
journalctl -u wikijs -f

# Search logs
journalctl -u wikijs | grep "Plugin"
```

**PM2**:
```bash
# View logs
pm2 logs wikijs

# Clear logs
pm2 flush wikijs
```

**Docker**:
```bash
# View logs
docker logs wikijs

# Follow logs
docker logs -f wikijs

# Last 100 lines
docker logs --tail 100 wikijs
```

### Database Queries

**Check plugin records**:
```sql
SELECT id, title, version, isEnabled, status 
FROM plugins;
```

**Check plugin errors**:
```sql
SELECT pluginId, errorType, message, createdAt 
FROM pluginErrors 
ORDER BY createdAt DESC 
LIMIT 10;
```

**Check plugin migrations**:
```sql
SELECT * 
FROM pluginMigrations 
WHERE pluginId = 'my-plugin';
```

### File System

**Check plugin files**:
```bash
ls -la plugins/installed/

# Check specific plugin
ls -la plugins/installed/my-plugin/
```

**Check plugin data**:
```bash
ls -la plugins/data/my-plugin/
```

**Check disk space**:
```bash
df -h
du -sh plugins/*
```

## Getting Help

### Gather Information

Before contacting support or plugin author:

1. **Plugin details**:
   ```graphql
   query {
     plugins {
       single(id: "my-plugin") {
         id
         title
         version
         isEnabled
         status
         permissions
       }
     }
   }
   ```

2. **Error logs**:
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

3. **System info**:
   ```graphql
   query {
     system {
       info {
         version
         platform
         nodeVersion
       }
     }
   }
   ```

4. **Server logs** (last 50 lines mentioning plugin):
   ```bash
   journalctl -u wikijs | grep "my-plugin" | tail -50
   ```

### Where to Get Help

1. **Plugin Documentation**: Check plugin's README.md
2. **Plugin Repository**: Check GitHub issues
3. **Wiki.js Community**: Discord at https://discord.gg/rcxt9QS2jd
4. **Wiki.js GitHub**: https://github.com/requarks/wiki/issues

### Reporting Issues

When reporting an issue, include:

- Plugin name and version
- Wiki.js version
- Error message and stack trace
- Steps to reproduce
- Server logs (relevant sections)
- Configuration (redact sensitive values)

## Prevention

### Best Practices

1. **Test in Development**: Test plugins before production
2. **Backup Before Installing**: Always backup database
3. **Monitor Logs**: Regularly check for errors
4. **Keep Updated**: Update plugins when available
5. **Review Code**: Review plugin code if possible
6. **Limit Permissions**: Only grant necessary permissions

### Regular Maintenance

**Weekly**:
- Check for plugin errors
- Review resource usage
- Check for plugin updates

**Monthly**:
- Review all installed plugins
- Remove unused plugins
- Update active plugins

**Before Major Updates**:
- Test plugins in staging
- Backup production database
- Document plugin versions

## Recovery Procedures

### Deactivate Problematic Plugin

```graphql
mutation {
  plugins {
    deactivate(id: "problematic-plugin") {
      responseResult { succeeded }
    }
  }
}
```

### Uninstall Plugin

```graphql
mutation {
  plugins {
    uninstall(id: "problematic-plugin") {
      responseResult { succeeded }
    }
  }
}
```

### Manual Removal

If GraphQL fails:

```bash
# Stop Wiki.js
sudo systemctl stop wikijs

# Remove plugin files
rm -rf plugins/installed/problematic-plugin

# Remove from database
mysql -u wikijs_user -p wikijs_db
DELETE FROM plugins WHERE id = 'problematic-plugin';
DELETE FROM pluginErrors WHERE pluginId = 'problematic-plugin';
DELETE FROM pluginMigrations WHERE pluginId = 'problematic-plugin';
exit;

# Start Wiki.js
sudo systemctl start wikijs
```

## Related Documentation

- [Installation Guide](./installation.md)
- [Configuration Guide](./configuration.md)
- [Security Guide](./security.md)
