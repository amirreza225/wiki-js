/**
 * Plugin Loader Tests
 *
 * Tests plugin discovery, extraction, and manifest validation
 */

const path = require('path')
const loader = require('../../plugins/loader')
const { createTestManifest, createMockWIKI } = require('../helpers/plugin-test-utils')

// Mock fs-extra
jest.mock('fs-extra')
const fs = require('fs-extra')

// Mock adm-zip
jest.mock('adm-zip')
const AdmZip = require('adm-zip')

// Mock yaml
jest.mock('js-yaml')
const yaml = require('js-yaml')

// Setup global WIKI
global.WIKI = createMockWIKI()

describe('plugins/loader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateManifest', () => {
    it('validates correct manifest', async () => {
      const manifest = createTestManifest()
      await expect(loader.validateManifest(manifest)).resolves.toBe(true)
    })

    it('validates manifest with all optional fields', async () => {
      const manifest = createTestManifest({
        keywords: ['test', 'example'],
        repository: {
          type: 'git',
          url: 'https://github.com/test/plugin'
        },
        homepage: 'https://example.com',
        hooks: ['page:save', 'user:login'],
        menuItems: [
          {
            location: 'admin',
            label: 'Test Menu',
            icon: 'test-icon',
            path: '/test',
            order: 100
          }
        ]
      })
      await expect(loader.validateManifest(manifest)).resolves.toBe(true)
    })

    describe('Required Fields', () => {
      it('rejects manifest without id', async () => {
        const manifest = createTestManifest()
        delete manifest.id
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/Invalid plugin manifest/)
      })

      it('rejects manifest without name', async () => {
        const manifest = createTestManifest()
        delete manifest.name
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/Invalid plugin manifest/)
      })

      it('rejects manifest without version', async () => {
        const manifest = createTestManifest()
        delete manifest.version
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/Invalid plugin manifest/)
      })

    })

    describe('ID Validation', () => {
      it('accepts valid kebab-case IDs', async () => {
        const validIds = [
          'test-plugin',
          'my-awesome-plugin',
          'plugin-123',
          'a-b-c'
        ]
        for (const id of validIds) {
          const manifest = createTestManifest({ id })
          await expect(loader.validateManifest(manifest)).resolves.toBe(true)
        }
      })

      it('rejects IDs with uppercase letters', async () => {
        const manifest = createTestManifest({ id: 'Test-Plugin' })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/does not match pattern/)
      })

      it('rejects IDs with underscores', async () => {
        const manifest = createTestManifest({ id: 'test_plugin' })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/does not match pattern/)
      })

      it('rejects IDs with spaces', async () => {
        const manifest = createTestManifest({ id: 'test plugin' })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/does not match pattern/)
      })

      it('allows IDs starting with number', async () => {
        const manifest = createTestManifest({ id: '123-plugin' })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })

      it('rejects IDs with special characters', async () => {
        const manifest = createTestManifest({ id: 'test@plugin' })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/does not match pattern/)
      })
    })

    describe('Version Validation', () => {
      it('accepts valid semantic versions', async () => {
        const validVersions = [
          '1.0.0',
          '0.1.0',
          '2.5.128',
          '1.0.0-alpha',
          '1.0.0-beta.1',
          '1.0.0+build.123'
        ]
        for (const version of validVersions) {
          const manifest = createTestManifest({ version })
          await expect(loader.validateManifest(manifest)).resolves.toBe(true)
        }
      })

      it('rejects invalid versions', async () => {
        const invalidVersions = [
          'v1.0.0',
          '1.0',
          '1',
          'not-semver',
          ''
        ]
        for (const version of invalidVersions) {
          const manifest = createTestManifest({ version })
          await expect(loader.validateManifest(manifest))
            .rejects.toThrow(/does not match pattern|Invalid plugin manifest/)
        }
      })
    })

    describe('Compatibility Validation', () => {
      it('accepts compatible Wiki.js version', async () => {
        const manifest = createTestManifest({
          compatibility: { wikijs: '>=2.5.0' }
        })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })

      it('rejects incompatible Wiki.js version (too new)', async () => {
        const manifest = createTestManifest({
          compatibility: { wikijs: '>=3.0.0' }
        })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/requires Wiki.js/)
      })

      it('rejects incompatible Wiki.js version (exact mismatch)', async () => {
        const manifest = createTestManifest({
          compatibility: { wikijs: '2.6.0' }
        })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/requires Wiki.js/)
      })

      it('accepts range with multiple conditions', async () => {
        const manifest = createTestManifest({
          compatibility: { wikijs: '>=2.5.0 <3.0.0' }
        })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })

      it('validates Node.js version if specified', async () => {
        const manifest = createTestManifest({
          compatibility: {
            wikijs: '>=2.5.0',
            node: '>=18.0.0'
          }
        })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })
    })

    describe('Permissions Validation', () => {
      it('validates permissions array', async () => {
        const manifest = createTestManifest({
          permissions: ['config:read', 'database:write']
        })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })

      it('rejects unknown permissions', async () => {
        const manifest = createTestManifest({
          permissions: ['invalid:permission']
        })
        await expect(loader.validateManifest(manifest))
          .rejects.toThrow(/Unknown permission/)
      })

      it('accepts empty permissions array', async () => {
        const manifest = createTestManifest({ permissions: [] })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })
    })

    describe('Config Schema Validation', () => {
      it('accepts valid JSON schema', async () => {
        const manifest = createTestManifest({
          config: {
            schema: {
              type: 'object',
              properties: {
                apiKey: { type: 'string' },
                enabled: { type: 'boolean', default: true }
              },
              required: ['apiKey']
            }
          }
        })
        await expect(loader.validateManifest(manifest)).resolves.toBe(true)
      })
    })
  })

  describe('loadManifest', () => {
    const testPluginPath = '/test/plugin/path'

    it('loads YAML manifest', async () => {
      const manifest = createTestManifest()
      fs.pathExists.mockResolvedValue(true)
      fs.readFile.mockResolvedValue('id: test-plugin\nversion: 1.0.0')
      yaml.load.mockReturnValue(manifest)

      const result = await loader.loadManifest(testPluginPath)

      expect(result).toEqual(manifest)
      expect(fs.pathExists).toHaveBeenCalledWith(
        path.join(testPluginPath, 'plugin.yml')
      )
      expect(yaml.load).toHaveBeenCalled()
    })

    it('falls back to JSON manifest if YAML not found', async () => {
      const manifest = createTestManifest()
      fs.pathExists
        .mockResolvedValueOnce(false) // plugin.yml not found
        .mockResolvedValueOnce(true)  // plugin.json found
      fs.readFile.mockResolvedValue(JSON.stringify(manifest))

      const result = await loader.loadManifest(testPluginPath)

      expect(result).toEqual(manifest)
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(testPluginPath, 'plugin.json'),
        'utf8'
      )
    })

    it('throws if no manifest found', async () => {
      fs.pathExists.mockResolvedValue(false)

      await expect(loader.loadManifest(testPluginPath))
        .rejects.toThrow(/No manifest found/)
    })

    it('throws on YAML parse error', async () => {
      fs.pathExists.mockResolvedValue(true)
      fs.readFile.mockResolvedValue('invalid: yaml: content:')
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error')
      })

      await expect(loader.loadManifest(testPluginPath))
        .rejects.toThrow()
    })
  })

  describe('extractPlugin', () => {
    const mockZipPath = '/test/plugin.zip'
    const mockPluginId = 'test-plugin'

    beforeEach(() => {
      const mockZipInstance = {
        extractAllTo: jest.fn(),
        getEntries: jest.fn(() => [
          { entryName: 'plugin.yml' },
          { entryName: 'server/index.js' }
        ])
      }
      AdmZip.mockImplementation(() => mockZipInstance)
    })

    it('extracts ZIP to target directory', async () => {
      const manifest = createTestManifest({ id: mockPluginId })

      fs.ensureDir.mockResolvedValue(undefined)
      fs.pathExists
        .mockResolvedValueOnce(false) // Plugin doesn't exist yet (checking installed path)
        .mockResolvedValueOnce(true)  // plugin.yml exists in extracted folder
      fs.readFile.mockResolvedValue('id: test-plugin\nversion: 1.0.0')
      yaml.load.mockReturnValue(manifest)

      const result = await loader.extractPlugin(mockZipPath, mockPluginId)

      expect(result).toEqual(manifest)
      expect(fs.ensureDir).toHaveBeenCalled()
      expect(AdmZip).toHaveBeenCalledWith(mockZipPath)
    })

    it('throws if ZIP is invalid', async () => {
      AdmZip.mockImplementation(() => {
        throw new Error('Invalid ZIP')
      })

      await expect(loader.extractPlugin(mockZipPath, mockPluginId))
        .rejects.toThrow(/Invalid ZIP/)
    })

    it('throws if extraction fails', async () => {
      const mockZipInstance = {
        extractAllTo: jest.fn(() => {
          throw new Error('Extraction failed')
        }),
        getEntries: jest.fn(() => [])
      }
      AdmZip.mockImplementation(() => mockZipInstance)

      await expect(loader.extractPlugin(mockZipPath, mockPluginId))
        .rejects.toThrow()
    })
  })

  describe('loadDependencies', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('loads plugin package.json', async () => {
      const packageJson = {
        name: 'test-plugin',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21'
        }
      }
      fs.pathExists.mockResolvedValue(true)
      fs.readFile.mockResolvedValue(JSON.stringify(packageJson))

      const deps = await loader.loadDependencies('/test/path')

      expect(deps).toEqual({
        'lodash': '^4.17.21'
      })
    })

    it('returns empty object if no package.json', async () => {
      fs.pathExists.mockResolvedValue(false)

      const deps = await loader.loadDependencies('/test/path')

      expect(deps).toEqual({})
    })

    it('filters out devDependencies', async () => {
      const packageJson = {
        dependencies: {
          'lodash': '^4.17.21'
        },
        devDependencies: {
          'jest': '^26.0.0'
        }
      }
      fs.pathExists.mockResolvedValue(true)
      fs.readFile.mockResolvedValue(JSON.stringify(packageJson))

      const deps = await loader.loadDependencies('/test/path')

      expect(deps).toEqual({
        'lodash': '^4.17.21'
      })
      expect(deps).not.toHaveProperty('jest')
    })
  })
})
