const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')

// Configure multer for ZIP uploads
const upload = multer({
  dest: path.join(WIKI.ROOTPATH, 'data', 'temp'),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        path.extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true)
    } else {
      cb(new Error('Only ZIP files are allowed'))
    }
  }
})

/**
 * POST /admin/plugins/upload
 * Upload and install plugin from ZIP file
 */
router.post('/upload',
  WIKI.auth.authenticate,
  upload.single('plugin'),
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        })
      }

      // Check if user has manage:system permission (admin)
      if (!_.some(req.user.permissions, pm => _.includes(['manage:system'], pm))) {
        WIKI.logger.warn(`[Plugins] Upload rejected for user ${req.user.email}: insufficient permissions`)
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to install plugins. Admin access required.'
        })
      }

      if (!req.file) {
        throw new Error('No file uploaded')
      }

      const tempPath = req.file.path

      WIKI.logger.info(`[Plugins] Installing plugin from uploaded file: ${req.file.originalname}`)

      // Install plugin using existing manager
      await WIKI.plugins.manager.installPlugin(tempPath)

      // Cleanup temp file
      await fs.remove(tempPath)

      res.json({
        success: true,
        message: 'Plugin installed successfully'
      })
    } catch (err) {
      // Cleanup on error
      if (req.file && req.file.path) {
        await fs.remove(req.file.path).catch(() => {})
      }

      WIKI.logger.error(`[Plugins] Failed to upload plugin: ${err.message}`)
      res.status(400).json({
        success: false,
        message: err.message
      })
    }
  }
)

module.exports = router
