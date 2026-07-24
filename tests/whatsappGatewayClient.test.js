const axios = require('axios');
const WhatsAppGatewayClient = require('../services/whatsappGatewayClient');
const { getSetting } = require('../config/settingsManager');

// Mock axios
jest.mock('axios');
// Mock settingsManager
jest.mock('../config/settingsManager');

describe('WhatsAppGatewayClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('formatNumber', () => {
    it('should return empty string if input is empty or null', () => {
      expect(WhatsAppGatewayClient.formatNumber('')).toBe('');
      expect(WhatsAppGatewayClient.formatNumber(null)).toBe('');
      expect(WhatsAppGatewayClient.formatNumber(undefined)).toBe('');
    });

    it('should convert 0 prefix to 62', () => {
      expect(WhatsAppGatewayClient.formatNumber('0812345678')).toBe('62812345678');
    });

    it('should keep 62 prefix', () => {
      expect(WhatsAppGatewayClient.formatNumber('62812345678')).toBe('62812345678');
    });

    it('should strip non-digits', () => {
      expect(WhatsAppGatewayClient.formatNumber('+62-812 3456 7890')).toBe('6281234567890');
    });

    it('should strip swhatsappnet suffix', () => {
      expect(WhatsAppGatewayClient.formatNumber('62812345678@s.whatsapp.net')).toBe('62812345678');
    });
  });

  describe('getConfig', () => {
    it('should read settings correctly', () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_type') return 'external';
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080/';
        if (key === 'whatsapp_gateway_apikey') return 'mysecretkey';
        if (key === 'whatsapp_gateway_instance') return 'myinstance';
        return fallback;
      });

      const config = WhatsAppGatewayClient.getConfig();
      expect(config.type).toBe('external');
      expect(config.url).toBe('http://localhost:8080'); // trimmed trailing slash
      expect(config.apiKey).toBe('mysecretkey');
      expect(config.instance).toBe('myinstance');
    });

    it('should handle undefined settings gracefully', () => {
      getSetting.mockImplementation((key, fallback) => fallback);
      const config = WhatsAppGatewayClient.getConfig();
      expect(config.type).toBe('local');
      expect(config.url).toBe('');
      expect(config.apiKey).toBe('');
      expect(config.instance).toBe('');
    });
  });

  describe('validateConfig', () => {
    it('should throw error if url is missing', () => {
      expect(() => {
        WhatsAppGatewayClient.validateConfig({ url: '' });
      }).toThrow('WhatsApp Gateway URL belum dikonfigurasi');
    });

    it('should not throw if url is present', () => {
      expect(() => {
        WhatsAppGatewayClient.validateConfig({ url: 'http://localhost' });
      }).not.toThrow();
    });
  });

  describe('buildRequest', () => {
    // WAHA
    it('should build request for WAHA text messages', () => {
      const config = {
        url: 'http://localhost:3000',
        apiKey: 'waha-key',
        instance: 'session1'
      };
      const params = { phone: '628123', text: 'hello' };
      const req = WhatsAppGatewayClient.buildRequest('text', params, config);

      expect(req.url).toBe('http://localhost:3000/api/sendText');
      expect(req.headers['X-Api-Key']).toBe('waha-key');
      expect(req.headers['Authorization']).toBe('Bearer waha-key');
      expect(req.data.chatId).toBe('628123@c.us');
      expect(req.data.text).toBe('hello');
      expect(req.data.session).toBe('session1');
    });

    it('should build request for WAHA image messages', () => {
      const config = {
        url: 'http://localhost:3000',
        apiKey: '',
        instance: ''
      };
      const params = { phone: '628123', base64Image: 'base64str', caption: 'my caption' };
      const req = WhatsAppGatewayClient.buildRequest('image', params, config);

      expect(req.url).toBe('http://localhost:3000/api/sendImage');
      expect(req.headers['X-Api-Key']).toBeUndefined();
      expect(req.data.file.data).toBe('base64str');
      expect(req.data.caption).toBe('my caption');
      expect(req.data.session).toBe('default'); // fallback instance
    });

    // Evolution API
    it('should build request for Evolution API text messages', () => {
      const config = {
        url: 'http://localhost:8080',
        apiKey: 'evo-key',
        instance: 'evo-inst'
      };
      const params = { phone: '628123', text: 'hello evo' };
      const req = WhatsAppGatewayClient.buildRequest('text', params, config);

      expect(req.url).toBe('http://localhost:8080/message/sendText/evo-inst');
      expect(req.headers['apikey']).toBe('evo-key');
      expect(req.data.number).toBe('628123');
      expect(req.data.text).toBe('hello evo');
    });

    it('should build request for Evolution API image messages', () => {
      const config = {
        url: 'http://localhost:8080',
        apiKey: 'evo-key',
        instance: 'myinstance'
      };
      const params = { phone: '628123', base64Image: 'base64str', caption: 'evo cap' };
      const req = WhatsAppGatewayClient.buildRequest('image', params, config);

      expect(req.url).toBe('http://localhost:8080/message/sendMedia/myinstance');
      expect(req.data.media).toBe('data:image/jpeg;base64,base64str');
      expect(req.data.mediaType).toBe('image');
    });

    it('should preserve data URI prefix if already present for Evolution API', () => {
      const config = {
        url: 'http://localhost:8080/message',
        apiKey: 'evo-key',
        instance: ''
      };
      const params = { phone: '628123', base64Image: 'data:image/png;base64,base64str', caption: 'evo cap' };
      const req = WhatsAppGatewayClient.buildRequest('image', params, config);

      expect(req.data.media).toBe('data:image/png;base64,base64str');
    });

    // Generic
    it('should build request for Generic text messages', () => {
      const config = {
        url: 'http://my-generic-gw.com',
        apiKey: 'gen-key',
        instance: ''
      };
      const params = { phone: '628123', text: 'hello generic' };
      const req = WhatsAppGatewayClient.buildRequest('text', params, config);

      expect(req.url).toBe('http://my-generic-gw.com/send');
      expect(req.headers['Authorization']).toBe('Bearer gen-key');
      expect(req.data.to).toBe('628123');
      expect(req.data.text).toBe('hello generic');
    });

    it('should build request for Generic image messages', () => {
      const config = {
        url: 'http://my-generic-gw.com',
        apiKey: '',
        instance: ''
      };
      const params = { phone: '628123', base64Image: 'base64str', caption: 'gen cap' };
      const req = WhatsAppGatewayClient.buildRequest('image', params, config);

      expect(req.url).toBe('http://my-generic-gw.com/send');
      expect(req.data.to).toBe('628123');
      expect(req.data.image).toBe('base64str');
      expect(req.data.caption).toBe('gen cap');
    });

    it('should build request without apiKey for all gateways', () => {
      // WAHA without apiKey
      const wahaConfig = { url: 'http://localhost:3000', apiKey: '', instance: '' };
      const wahaParams = { phone: '628123', text: 'hello' };
      const wahaReq = WhatsAppGatewayClient.buildRequest('text', wahaParams, wahaConfig);
      expect(wahaReq.headers['X-Api-Key']).toBeUndefined();
      expect(wahaReq.headers['Authorization']).toBeUndefined();

      // Evolution API without apiKey
      const evoConfig = { url: 'http://localhost:8080', apiKey: '', instance: 'myinstance' };
      const evoParams = { phone: '628123', text: 'hello evo' };
      const evoReq = WhatsAppGatewayClient.buildRequest('text', evoParams, evoConfig);
      expect(evoReq.headers['apikey']).toBeUndefined();

      // Generic without apiKey
      const genConfig = { url: 'http://my-generic-gw.com', apiKey: '', instance: '' };
      const genParams = { phone: '628123', text: 'hello generic' };
      const genReq = WhatsAppGatewayClient.buildRequest('text', genParams, genConfig);
      expect(genReq.headers['Authorization']).toBeUndefined();
    });

    it('should build request without caption for all gateways', () => {
      // WAHA without caption
      const wahaConfig = { url: 'http://localhost:3000', apiKey: '', instance: '' };
      const wahaParams = { phone: '628123', base64Image: 'base64str', caption: '' };
      const wahaReq = WhatsAppGatewayClient.buildRequest('image', wahaParams, wahaConfig);
      expect(wahaReq.data.caption).toBe('');

      // Evolution API without caption
      const evoConfig = { url: 'http://localhost:8080', apiKey: '', instance: 'myinstance' };
      const evoParams = { phone: '628123', base64Image: 'base64str', caption: undefined };
      const evoReq = WhatsAppGatewayClient.buildRequest('image', evoParams, evoConfig);
      expect(evoReq.data.caption).toBe('');

      // Generic without caption
      const genConfig = { url: 'http://my-generic-gw.com', apiKey: '', instance: '' };
      const genParams = { phone: '628123', base64Image: 'base64str', caption: null };
      const genReq = WhatsAppGatewayClient.buildRequest('image', genParams, genConfig);
      expect(genReq.data.caption).toBe('');
    });
  });

  describe('sendText', () => {
    it('should return false if to or text is missing', async () => {
      expect(await WhatsAppGatewayClient.sendText('', 'msg')).toBe(false);
      expect(await WhatsAppGatewayClient.sendText('628123', '')).toBe(false);
    });

    it('should return true if request is successful (2xx)', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      axios.mockResolvedValue({ status: 200, data: { success: true } });

      const res = await WhatsAppGatewayClient.sendText('0812345678', 'Hello unit test');
      expect(res).toBe(true);
      expect(axios).toHaveBeenCalled();
    });

    it('should return false if request returns non-2xx status', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      axios.mockResolvedValue({ status: 400, data: { error: 'Bad Request' } });

      const res = await WhatsAppGatewayClient.sendText('0812345678', 'Hello unit test');
      expect(res).toBe(false);
    });

    it('should return false if request fails with error', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        if (key === 'whatsapp_gateway_apikey') return 'mykey';
        return fallback;
      });

      axios.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal Error' }
        }
      });

      const res = await WhatsAppGatewayClient.sendText('0812345678', 'Hello unit test');
      expect(res).toBe(false);
    });

    it('should handle generic connection error', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      axios.mockRejectedValue(new Error('Network error'));

      const res = await WhatsAppGatewayClient.sendText('0812345678', 'Hello unit test');
      expect(res).toBe(false);
    });
  });

  describe('sendImage', () => {
    it('should return false if to or image is missing', async () => {
      expect(await WhatsAppGatewayClient.sendImage('', 'img')).toBe(false);
      expect(await WhatsAppGatewayClient.sendImage('628123', null)).toBe(false);
    });

    it('should handle Buffer image inputs', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080/message';
        return fallback;
      });

      axios.mockResolvedValue({ status: 201, data: { success: true } });

      const buffer = Buffer.from('mock-image-data');
      const res = await WhatsAppGatewayClient.sendImage('0812345678', buffer, 'Caption Buffer');
      expect(res).toBe(true);
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          media: 'data:image/jpeg;base64,bW9jay1pbWFnZS1kYXRh'
        })
      }));
    });

    it('should handle Base64 string inputs and strip prefix', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080/message';
        return fallback;
      });

      axios.mockResolvedValue({ status: 200, data: { success: true } });

      const base64Str = 'data:image/png;base64,iVBORw0KGgo=';
      const res = await WhatsAppGatewayClient.sendImage('0812345678', base64Str, 'Caption String');
      expect(res).toBe(true);
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          media: 'data:image/jpeg;base64,iVBORw0KGgo='
        })
      }));
    });

    it('should return false if image data is invalid / not buffer or string', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      const res = await WhatsAppGatewayClient.sendImage('0812345678', {}, 'Caption');
      expect(res).toBe(false);
    });

    it('should return false if axios post returns error status', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      axios.mockResolvedValue({ status: 500, data: {} });

      const res = await WhatsAppGatewayClient.sendImage('0812345678', 'base64str', 'Caption');
      expect(res).toBe(false);
    });

    it('should return false and log error on rejection', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      axios.mockRejectedValue(new Error('Upload timeout'));

      const res = await WhatsAppGatewayClient.sendImage('0812345678', 'base64str', 'Caption');
      expect(res).toBe(false);
    });

    it('should return false and log error on response rejection', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080/message';
        return fallback;
      });

      axios.mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'Bad Image data' }
        }
      });

      const res = await WhatsAppGatewayClient.sendImage('0812345678', 'base64str', 'Caption');
      expect(res).toBe(false);
    });
  });

  describe('checkStatus', () => {
    it('should return false if url is not configured', async () => {
      getSetting.mockImplementation((key, fallback) => fallback);
      const res = await WhatsAppGatewayClient.checkStatus();
      expect(res).toBe(false);
    });

    it('should perform check status for WAHA url', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:3000';
        if (key === 'whatsapp_gateway_apikey') return 'waha-key';
        return fallback;
      });

      axios.get.mockResolvedValue({ status: 200 });

      const res = await WhatsAppGatewayClient.checkStatus();
      expect(res).toBe(true);
      expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/api/sessions', expect.objectContaining({
        headers: expect.objectContaining({
          'X-Api-Key': 'waha-key'
        })
      }));
    });

    it('should perform check status for Evolution API url', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        if (key === 'whatsapp_gateway_instance') return 'myinstance';
        return fallback;
      });

      axios.get.mockResolvedValue({ status: 200 });

      const res = await WhatsAppGatewayClient.checkStatus();
      expect(res).toBe(true);
      expect(axios.get).toHaveBeenCalledWith('http://localhost:8080/instance/connectionState/myinstance', expect.any(Object));
    });

    it('should perform default health check if generic url is used', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://my-generic-gw.com';
        return fallback;
      });

      axios.get.mockResolvedValue({ status: 200 });

      const res = await WhatsAppGatewayClient.checkStatus();
      expect(res).toBe(true);
      expect(axios.get).toHaveBeenCalledWith('http://my-generic-gw.com', expect.any(Object));
    });

    it('should return false if health check API returns error status or fails', async () => {
      getSetting.mockImplementation((key, fallback) => {
        if (key === 'whatsapp_gateway_url') return 'http://localhost:8080';
        return fallback;
      });

      axios.get.mockRejectedValue(new Error('Gateway Down'));

      const res = await WhatsAppGatewayClient.checkStatus();
      expect(res).toBe(false);
    });
  });
});
