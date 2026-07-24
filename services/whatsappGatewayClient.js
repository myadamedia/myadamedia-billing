const axios = require('axios');
const { logger } = require('../config/logger');
const { getSetting } = require('../config/settingsManager');

/**
 * WhatsApp Gateway Client for communicating with external APIs
 * Supports: Evolution API, WAHA (WhatsApp HTTP API), and Generic APIs.
 */
class WhatsAppGatewayClient {
  /**
   * Format phone number to clean numeric digits
   * @param {string} to - Raw phone number/JID
   * @returns {string} Clean numeric phone number (e.g. 628123456789)
   */
  static formatNumber(to) {
    if (!to) return '';
    let digits = String(to).replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    }
    return digits;
  }

  /**
   * Get client configuration from settings
   * @returns {object} Configuration object
   */
  static getConfig() {
    const type = getSetting('whatsapp_gateway_type', 'local');
    const url = (getSetting('whatsapp_gateway_url', '') || '').trim().replace(/\/$/, '');
    const apiKey = (getSetting('whatsapp_gateway_apikey', '') || '').trim();
    const instance = (getSetting('whatsapp_gateway_instance', '') || '').trim();

    return { type, url, apiKey, instance };
  }

  /**
   * Validate configuration
   * @param {object} config - Configuration object
   * @throws {Error} if configuration is invalid
   */
  static validateConfig(config) {
    if (!config.url) {
      throw new Error('WhatsApp Gateway URL belum dikonfigurasi');
    }
  }

  /**
   * Detect and determine request payload and endpoint based on URL structure or config
   * @param {string} type - 'text' or 'image'
   * @param {object} params - { phone, text, base64Image, caption }
   * @param {object} config - Configuration details
   * @returns {object} { endpoint, method, headers, data }
   */
  static buildRequest(type, params, config) {
    const { url, apiKey, instance } = config;
    const { phone, text, base64Image, caption } = params;

    // Default headers
    const headers = {
      'Content-Type': 'application/json'
    };

    // Auto-detect gateway behavior from URL path
    const isWaha = url.includes('/api') || url.includes(':3000'); // common indicators for WAHA
    const isEvolution = !isWaha && (instance || url.includes('/message'));

    if (isWaha) {
      // WAHA Configuration
      if (apiKey) {
        headers['X-Api-Key'] = apiKey;
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (type === 'text') {
        return {
          url: `${url}/api/sendText`,
          method: 'post',
          headers,
          data: {
            chatId: `${phone}@c.us`,
            text: text,
            session: instance || 'default'
          }
        };
      } else {
        // For images in WAHA
        return {
          url: `${url}/api/sendImage`,
          method: 'post',
          headers,
          data: {
            chatId: `${phone}@c.us`,
            file: {
              mimetype: 'image/jpeg',
              data: base64Image,
              filename: 'image.jpg'
            },
            caption: caption || '',
            session: instance || 'default'
          }
        };
      }
    } else if (isEvolution) {
      // Evolution API Configuration
      if (apiKey) {
        headers['apikey'] = apiKey;
      }
      
      const instanceName = instance || 'default';

      if (type === 'text') {
        return {
          url: `${url}/message/sendText/${instanceName}`,
          method: 'post',
          headers,
          data: {
            number: phone,
            text: text
          }
        };
      } else {
        // Evolution API sendMedia accepts standard base64 data URI or raw base64 depending on version
        const mediaData = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
        return {
          url: `${url}/message/sendMedia/${instanceName}`,
          method: 'post',
          headers,
          data: {
            number: phone,
            caption: caption || '',
            media: mediaData,
            mediaType: 'image'
          }
        };
      }
    } else {
      // Generic / Custom Webhook Fallback
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (type === 'text') {
        return {
          url: `${url}/send`,
          method: 'post',
          headers,
          data: {
            to: phone,
            text: text
          }
        };
      } else {
        return {
          url: `${url}/send`,
          method: 'post',
          headers,
          data: {
            to: phone,
            caption: caption || '',
            image: base64Image
          }
        };
      }
    }
  }

  /**
   * Send WhatsApp text message using external gateway
   * @param {string} to - Destination phone number
   * @param {string} text - Message content
   * @returns {Promise<boolean>} success status
   */
  static async sendText(to, text) {
    if (!to || !text) {
      logger.warn('[WA Gateway] Pengiriman dibatalkan: Nomor tujuan atau teks pesan kosong');
      return false;
    }

    try {
      const config = this.getConfig();
      this.validateConfig(config);

      const phone = this.formatNumber(to);
      const requestOptions = this.buildRequest('text', { phone, text }, config);

      logger.info(`[WA Gateway] Mengirim pesan ke ${phone} via URL: ${requestOptions.url}`);

      const response = await axios({
        method: requestOptions.method,
        url: requestOptions.url,
        headers: requestOptions.headers,
        data: requestOptions.data,
        timeout: 15000 // 15 seconds timeout
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info(`[WA Gateway] Pesan berhasil dikirim ke ${phone}`);
        return true;
      }

      logger.error(`[WA Gateway] Gagal mengirim pesan ke ${phone}. Status: ${response.status}`);
      return false;
    } catch (error) {
      const errorMsg = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
      logger.error(`[WA Gateway] Error saat mengirim pesan teks ke ${to}: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Send WhatsApp image message using external gateway
   * @param {string} to - Destination phone number
   * @param {Buffer|string} imageBufferOrBase64 - Image content as Buffer or base64 string
   * @param {string} caption - Optional caption
   * @returns {Promise<boolean>} success status
   */
  static async sendImage(to, imageBufferOrBase64, caption = '') {
    if (!to || !imageBufferOrBase64) {
      logger.warn('[WA Gateway] Pengiriman gambar dibatalkan: Nomor tujuan atau data gambar kosong');
      return false;
    }

    try {
      const config = this.getConfig();
      this.validateConfig(config);

      const phone = this.formatNumber(to);
      
      // Determine base64 string representation
      let base64Image = '';
      if (Buffer.isBuffer(imageBufferOrBase64)) {
        base64Image = imageBufferOrBase64.toString('base64');
      } else if (typeof imageBufferOrBase64 === 'string') {
        // Strip data URI prefix if present for uniform representation, but preserve it where needed in buildRequest
        base64Image = imageBufferOrBase64.replace(/^data:image\/\w+;base64,/, '');
      }

      if (!base64Image) {
        logger.warn('[WA Gateway] Format data gambar tidak valid');
        return false;
      }

      const requestOptions = this.buildRequest('image', { phone, base64Image, caption }, config);

      logger.info(`[WA Gateway] Mengirim gambar ke ${phone} via URL: ${requestOptions.url}`);

      const response = await axios({
        method: requestOptions.method,
        url: requestOptions.url,
        headers: requestOptions.headers,
        data: requestOptions.data,
        timeout: 25000 // 25 seconds timeout for media
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info(`[WA Gateway] Gambar berhasil dikirim ke ${phone}`);
        return true;
      }

      logger.error(`[WA Gateway] Gagal mengirim gambar ke ${phone}. Status: ${response.status}`);
      return false;
    } catch (error) {
      const errorMsg = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
      logger.error(`[WA Gateway] Error saat mengirim gambar ke ${to}: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Perform health check against the external gateway
   * @returns {Promise<boolean>} true if online/healthy
   */
  static async checkStatus() {
    try {
      const config = this.getConfig();
      if (!config.url) return false;

      let checkUrl = config.url;
      const headers = {};
      if (config.apiKey) {
        headers['apikey'] = config.apiKey;
        headers['X-Api-Key'] = config.apiKey;
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      // Auto check endpoint based on standard endpoints
      if (config.url.includes('/api') || config.url.includes(':3000')) {
        // WAHA health check or status
        checkUrl = `${config.url}/api/sessions`;
      } else if (config.instance) {
        // Evolution API session status check
        checkUrl = `${config.url}/instance/connectionState/${config.instance}`;
      }

      const response = await axios.get(checkUrl, { headers, timeout: 5000 });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`[WA Gateway] Health check gagal untuk URL ${getSetting('whatsapp_gateway_url')}: ${error.message}`);
      return false;
    }
  }
}

module.exports = WhatsAppGatewayClient;
