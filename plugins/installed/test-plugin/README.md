# Test Plugin for Wiki.js

This is a demonstration plugin showcasing the Wiki.js plugin system capabilities.

## Features

### Client-Side Features
- **UI Injection**: Adds a purple "Test Plugin" button to the page toolbar
- **Vue Component**: Custom TestButton component
- **Vuex Store**: Example store module for state management
- **Notifications**: Shows success message when button is clicked

### Server-Side Features
- **Lifecycle Hooks**: Init, activated, deactivated methods
- **Event Hooks**: Responds to page:save and user:login events
- **Logging**: Comprehensive logging of plugin activities

### Admin Features
- **Configuration**: Boolean and string configuration options
- **Admin Page**: Placeholder for plugin admin interface

## Installation

The plugin is already installed in `/plugins/installed/test-plugin/`.

To activate it:

1. **Build plugin assets**:
   ```bash
   yarn build:plugins
   ```

2. **Restart Wiki.js**:
   ```bash
   yarn dev
   ```

3. **Install the plugin via Admin UI**:
   - Navigate to Admin > Plugins
   - The test-plugin should appear in the list
   - Click "Activate"

4. **See it in action**:
   - Navigate to any wiki page
   - Look for the purple "Test Plugin" button in the toolbar
   - Click it to see the notification!

## What It Demonstrates

### ✅ Phase 1 Features
- Plugin manifest (plugin.yml)
- Server-side entry point
- Hook system integration
- Lifecycle management
- Configuration schema

### ✅ Phase 2 Features
- Client-side code loading
- Vue component registration
- UI injection points (page:toolbar)
- Vuex store module
- Admin page registration
- Build system integration

## File Structure

```
test-plugin/
├── plugin.yml              # Plugin manifest
├── package.json           # NPM package definition
├── README.md              # This file
├── client/                # Client-side code
│   ├── index.js          # Entry point
│   └── components/
│       └── TestButton.vue # Toolbar button component
└── server/                # Server-side code
    ├── index.js          # Entry point
    └── hooks/            # Hook handlers
        ├── pageSave.js   # page:save hook
        └── userLogin.js  # user:login hook
```

## Testing

1. **Test UI Injection**: Check if button appears in page toolbar
2. **Test Notifications**: Click button and verify notification
3. **Test Hooks**: Save a page or login and check server logs
4. **Test Configuration**: Try updating config in Admin UI

## Development

To modify the plugin:

1. Edit files in `/plugins/installed/test-plugin/`
2. Rebuild assets: `yarn build:plugins`
3. Restart server or use hot reload (if enabled)

## License

MIT
