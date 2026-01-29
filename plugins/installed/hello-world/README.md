# Hello World Plugin

A simple example plugin demonstrating the Wiki.js plugin system.

## Features

- Demonstrates plugin initialization
- Shows how to use plugin configuration
- Implements lifecycle hooks (page:save, user:login)
- Uses plugin logger for output
- Accesses WIKI object for version info

## Configuration

- **Greeting Message**: Customize the greeting message
- **Enable Plugin**: Toggle plugin on/off

## Hooks

### page:save
Triggered when a page is saved. Logs the page title and user who saved it.

### user:login
Triggered when a user logs in. Logs a greeting message with the user's name.

## Permissions

- `config:read` - Read plugin configuration
- `events:emit` - Emit events (required for hooks)
- `core:read` - Access WIKI object for version info

## Development

This plugin serves as a template for creating new Wiki.js plugins. Copy and modify as needed for your own plugins.
