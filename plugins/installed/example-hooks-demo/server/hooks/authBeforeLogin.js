/**
 * Auth Before Login Hook
 * Blocking hook that can prevent login
 * Perfect for rate limiting, IP blocking, etc.
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  if (this.config.logAuthentication) {
    this.logger.info(`Login attempt: ${data.username} from ${data.ip} via ${data.strategy}`)
  }

  // Example: Implement rate limiting
  // const attempts = await this.cache.get(`login:${data.ip}`)
  // if (attempts > 5) {
  //   data.allow = false
  //   data.blockReason = 'Too many login attempts'
  // }

  return data
}
