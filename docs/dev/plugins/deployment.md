# Packaging and Deploying Plugins

## Overview

This guide explains how to package your Wiki.js plugin for distribution and install it on Wiki.js instances.

## Plugin Package Structure

A distributable plugin package is a **ZIP file** containing:

```
my-plugin.zip
├── plugin.yml              # Required: Plugin manifest
├── README.md               # Recommended: Documentation
├── LICENSE                 # Recommended: License file
├── package.json            # Optional: npm dependencies
├── server/                 # Server-side code
│   ├── index.js           # Required: Main entry point
│   ├── models/            # Optional: Database models
│   ├── routes/            # Optional: API routes
│   └── services/          # Optional: Business logic
├── client/                 # Optional: Client-side code (Phase 2)
│   ├── components/
│   └── pages/
├── graphql/                # Optional: GraphQL extensions
│   ├── schema.graphql
│   └── resolvers.js
├── migrations/             # Optional: Database migrations
│   └── 20240129_init.js
└── locales/                # Optional: Translations
    ├── en.yml
    └── fr.yml
```

## Building a Plugin Package

### Manual Packaging

#### 1. Ensure Required Files Exist

**Required**:
- `plugin.yml` or `plugin.json` - Plugin manifest
- `server/index.js` - Main entry point

**Recommended**:
- `README.md` - Usage instructions
- `LICENSE` - License terms

#### 2. Validate the Manifest

Check that your `plugin.yml` is valid:

```yaml
id: my-plugin
title: My Plugin
version: 1.0.0
description: A brief description
author: Your Name
license: MIT

compatibility:
  wikijs: ">=2.5.0"

permissions:
  - hooks:register
  - logger:use

config:
  schema:
    type: object
    properties:
      enabled:
        type: boolean
        default: true
```

Validate syntax:
```bash
# Check YAML syntax
yamllint plugin.yml

# Or use an online validator
```

#### 3. Create ZIP Archive

**Using Command Line (macOS/Linux)**:
```bash
cd plugins/installed/my-plugin
zip -r ../../../my-plugin-1.0.0.zip . -x "*.git*" -x "node_modules/*" -x ".DS_Store"
```

**Using Command Line (Windows)**:
```powershell
cd plugins\installed\my-plugin
Compress-Archive -Path * -DestinationPath ..\..\..\my-plugin-1.0.0.zip
```

**Using Node.js Script**:
```javascript
// build.js
const AdmZip = require('adm-zip')
const path = require('path')

const zip = new AdmZip()
const pluginDir = path.join(__dirname, 'plugins/installed/my-plugin')

// Add all files
zip.addLocalFolder(pluginDir)

// Remove unnecessary files
zip.deleteFile('.git/')
zip.deleteFile('node_modules/')
zip.deleteFile('.DS_Store')

// Write archive
zip.writeZip('my-plugin-1.0.0.zip')
console.log('Plugin packaged successfully!')
```

#### 4. Verify Package Contents

```bash
# List contents
unzip -l my-plugin-1.0.0.zip

# Should show:
#   plugin.yml
#   server/index.js
#   README.md
#   LICENSE
#   (other files)
```

### Automated Build Script

Create `scripts/build-plugin.sh`:

```bash
#!/bin/bash
# build-plugin.sh - Build plugin ZIP package

PLUGIN_ID="my-plugin"
PLUGIN_DIR="plugins/installed/$PLUGIN_ID"
VERSION=$(grep "version:" "$PLUGIN_DIR/plugin.yml" | cut -d' ' -f2)
OUTPUT_FILE="dist/$PLUGIN_ID-$VERSION.zip"

echo "Building $PLUGIN_ID v$VERSION..."

# Create dist directory
mkdir -p dist

# Remove old package
rm -f "$OUTPUT_FILE"

# Create ZIP (exclude unnecessary files)
cd "$PLUGIN_DIR"
zip -r "../../../$OUTPUT_FILE" . \
  -x "*.git*" \
  -x "node_modules/*" \
  -x "*.test.js" \
  -x ".DS_Store" \
  -x "*.log"

cd ../../..

echo "Package created: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
```

Make executable and run:
```bash
chmod +x scripts/build-plugin.sh
./scripts/build-plugin.sh
```

### Package.json Script

Add to `package.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "scripts": {
    "build": "node scripts/build.js",
    "validate": "node scripts/validate.js",
    "package": "npm run validate && npm run build"
  }
}
```

## Installing Plugins

### Method 1: Via GraphQL API (Recommended)

#### Upload ZIP File

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

**Using GraphQL Playground**:
1. Navigate to `http://localhost:3000/graphql`
2. Authenticate as admin
3. Use the file upload mutation above
4. Upload your ZIP file

**Using cURL**:
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F operations='{"query":"mutation($file:Upload!){plugins{install(file:$file){responseResult{succeeded message}}}}","variables":{"file":null}}' \
  -F map='{"file":["variables.file"]}' \
  -F file=@my-plugin-1.0.0.zip
```

#### Activate Plugin

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

If `requiresRestart: true`, restart the server:
```bash
# Using systemd
sudo systemctl restart wikijs

# Using PM2
pm2 restart wikijs

# Manual
pkill -f 'node server'
yarn start
```

### Method 2: Manual Installation

#### 1. Extract to Plugin Directory

```bash
# Copy ZIP to server
scp my-plugin-1.0.0.zip user@server:/tmp/

# SSH to server
ssh user@server

# Extract to plugins directory
cd /path/to/wikijs
unzip /tmp/my-plugin-1.0.0.zip -d plugins/installed/my-plugin
```

#### 2. Install Dependencies (if package.json exists)

```bash
cd plugins/installed/my-plugin
npm install --production
```

#### 3. Restart Wiki.js

```bash
# The plugin will be discovered on startup
sudo systemctl restart wikijs
```

#### 4. Activate via GraphQL

Use the GraphQL mutation from Method 1 to activate.

### Method 3: From URL (Future)

**Status**: Planned for Phase 4

```graphql
mutation {
  plugins {
    installFromUrl(url: "https://example.com/my-plugin-1.0.0.zip") {
      responseResult {
        succeeded
        message
      }
    }
  }
}
```

## Distribution Channels

### 1. GitHub Releases

**Recommended for open-source plugins**

#### Setup GitHub Release

1. Create a GitHub repository for your plugin
2. Tag a release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. Create release on GitHub:
   - Go to repository → Releases → New Release
   - Select tag `v1.0.0`
   - Upload `my-plugin-1.0.0.zip` as asset
   - Add release notes

#### Install from GitHub Release

Users can download the ZIP from:
```
https://github.com/username/my-plugin/releases/download/v1.0.0/my-plugin-1.0.0.zip
```

Then install via GraphQL upload.

### 2. Private Distribution

For internal plugins:

#### Self-Hosted

Host ZIP files on your own server:
```
https://plugins.yourcompany.com/my-plugin-1.0.0.zip
```

#### Version Manifest

Create a `manifest.json` for update checking:
```json
{
  "id": "my-plugin",
  "versions": [
    {
      "version": "1.1.0",
      "releaseDate": "2024-02-01",
      "downloadUrl": "https://plugins.yourcompany.com/my-plugin-1.1.0.zip",
      "sha256": "abc123...",
      "changelog": "Added feature X, fixed bug Y"
    },
    {
      "version": "1.0.0",
      "releaseDate": "2024-01-15",
      "downloadUrl": "https://plugins.yourcompany.com/my-plugin-1.0.0.zip",
      "sha256": "def456...",
      "changelog": "Initial release"
    }
  ]
}
```

## Version Management

### Semantic Versioning

Follow [semver.org](https://semver.org):

- **1.0.0** → Initial release
- **1.0.1** → Bug fix (patch)
- **1.1.0** → New feature (minor)
- **2.0.0** → Breaking change (major)

### Update Plugin Manifest

When releasing a new version:

1. Update `version` in `plugin.yml`:
   ```yaml
   version: 1.1.0
   ```

2. Update `version` in `package.json` (if exists):
   ```json
   {
     "version": "1.1.0"
   }
   ```

3. Update CHANGELOG.md:
   ```markdown
   ## [1.1.0] - 2024-02-01
   ### Added
   - New feature X
   
   ### Fixed
   - Bug Y
   ```

### Compatibility Ranges

Specify compatible Wiki.js versions:

```yaml
compatibility:
  wikijs: ">=2.5.0 <3.0.0"  # Works with 2.5.x and 2.x, but not 3.x
```

**Examples**:
- `">=2.5.0"` - Any version 2.5.0 or higher
- `"^2.5.0"` - 2.5.0 up to (but not including) 3.0.0
- `"~2.5.0"` - 2.5.0 up to (but not including) 2.6.0
- `"2.5.x"` - Any 2.5.x version

## Plugin Updates

### Manual Update

1. **Deactivate** old version
2. **Uninstall** old version (optional)
3. **Install** new version
4. **Activate** new version

```graphql
# Deactivate
mutation {
  plugins {
    deactivate(id: "my-plugin") {
      responseResult { succeeded }
    }
  }
}

# Install new version (upload new ZIP)
mutation InstallPlugin($file: Upload!) {
  plugins {
    install(file: $file) {
      responseResult { succeeded }
    }
  }
}

# Activate
mutation {
  plugins {
    activate(id: "my-plugin") {
      responseResult { succeeded }
    }
  }
}
```

### Migration Considerations

If your update includes database changes:

1. Create migration file in `migrations/`:
   ```javascript
   // migrations/20240201_add_new_column.js
   exports.up = async (knex) => {
     await knex.schema.table('plugin_myplugin_data', table => {
       table.string('newColumn').nullable()
     })
   }
   
   exports.down = async (knex) => {
     await knex.schema.table('plugin_myplugin_data', table => {
       table.dropColumn('newColumn')
     })
   }
   ```

2. Migrations run automatically during installation

## Testing Deployment

### Local Testing

1. **Package plugin**:
   ```bash
   ./scripts/build-plugin.sh
   ```

2. **Test installation**:
   ```bash
   # Start Wiki.js
   yarn dev
   
   # In another terminal, install via API
   curl -X POST http://localhost:3000/graphql \
     -F operations='...' \
     -F file=@dist/my-plugin-1.0.0.zip
   ```

3. **Verify**:
   - Check plugin appears in list
   - Activate plugin
   - Test functionality
   - Check logs for errors

### Test Checklist

- [ ] Plugin installs without errors
- [ ] Manifest is valid
- [ ] Dependencies install correctly
- [ ] Migrations run successfully
- [ ] Plugin activates without errors
- [ ] Hooks are registered
- [ ] Configuration UI displays correctly
- [ ] Core functionality works
- [ ] Deactivation cleans up properly
- [ ] Uninstallation removes all data

## Security Considerations

### Before Publishing

1. **Review code** for security issues:
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Command injection
   - Path traversal
   - Hardcoded secrets

2. **Audit dependencies**:
   ```bash
   npm audit
   ```

3. **Check licenses**:
   - Ensure all dependencies have compatible licenses
   - Include NOTICE file if required by dependencies

4. **Test permissions**:
   - Verify only requested permissions are used
   - Test with minimal permissions

### Package Signing (Future)

**Status**: Planned for Phase 4

Will support:
- GPG signatures for packages
- Verification during installation
- Certificate-based signing

## Troubleshooting

### Plugin Won't Install

**Error**: "Invalid manifest"
- Check `plugin.yml` syntax
- Ensure all required fields present
- Validate against JSON Schema

**Error**: "Incompatible version"
- Check `compatibility.wikijs` range
- Update if targeting newer Wiki.js version

**Error**: "Permission denied"
- Check file permissions
- Ensure ZIP file is readable

### Plugin Won't Activate

**Error**: "Missing dependencies"
- Run `npm install` in plugin directory
- Include `node_modules/` or `package.json` in ZIP

**Error**: "Database migration failed"
- Check migration file syntax
- Ensure database user has CREATE TABLE permissions
- Review migration logs

### Plugin Errors After Install

**Error**: "Module not found"
- Ensure all files are included in ZIP
- Check require() paths are correct
- Verify `server/index.js` exists

**Error**: "Permission denied" (runtime)
- Verify permissions declared in manifest
- Check permission names are correct

## Continuous Integration

### GitHub Actions Example

`.github/workflows/build.yml`:
```yaml
name: Build Plugin

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Build package
        run: npm run build
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*.zip
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Best Practices Summary

### ✓ Packaging
- Include README.md and LICENSE
- Exclude `.git/`, `node_modules/`, test files
- Use semantic versioning
- Validate manifest before packaging

### ✓ Distribution
- Use GitHub Releases for public plugins
- Provide clear installation instructions
- Maintain changelog
- Test installation process

### ✓ Updates
- Use migrations for database changes
- Test upgrade path from previous versions
- Document breaking changes
- Support graceful degradation

### ✓ Security
- Review code for vulnerabilities
- Audit dependencies
- Never include secrets in package
- Test with minimal permissions

## Related Documentation

- [Getting Started Guide](./getting-started.md)
- [API Reference](./api-reference.md)
- [Testing Guide](./testing.md)
- [Best Practices](./best-practices.md)
- [Architecture Overview](./architecture.md)
