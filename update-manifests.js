const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const { Client } = require('pg')

async function updateManifests() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'wikijs',
    password: 'wikijsrocks',
    database: 'wiki'
  })

  await client.connect()

  const pluginsPath = path.join(__dirname, 'plugins', 'installed')
  const pluginDirs = fs.readdirSync(pluginsPath)

  for (const pluginDir of pluginDirs) {
    const pluginPath = path.join(pluginsPath, pluginDir)
    const manifestPath = path.join(pluginPath, 'plugin.yml')

    if (fs.existsSync(manifestPath)) {
      const manifestYaml = fs.readFileSync(manifestPath, 'utf8')
      const manifest = yaml.load(manifestYaml)

      console.log(`Updating manifest for ${manifest.id}...`)

      await client.query(
        'UPDATE plugins SET manifest = $1 WHERE id = $2',
        [JSON.stringify(manifest), manifest.id]
      )

      console.log(`✓ Updated ${manifest.id}`)
    }
  }

  await client.end()
  console.log('\nAll manifests updated!')
}

updateManifests().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
