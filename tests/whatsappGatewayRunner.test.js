const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn()
}));

// Spy on fs.existsSync globally
jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

// Spy on process.on to capture handlers when registerExitHandlers is called
const capturedExitHandlers = {};
const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
  capturedExitHandlers[event] = handler;
  return process;
});

const WhatsAppGatewayRunner = require('../services/whatsappGatewayRunner');

describe('WhatsAppGatewayRunner', () => {
  let mockChildProcess;
  let processExitSpy;
  let originalPlatform;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear global tracking
    global.evolutionApiProcess = null;

    // Mock Child Process
    mockChildProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn()
    };
    spawn.mockReturnValue(mockChildProcess);

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    originalPlatform = process.platform;
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  afterAll(() => {
    processOnSpy.mockRestore();
    fs.existsSync.mockRestore();
  });

  describe('getActiveGatewayType', () => {
    it('should return waha if waha directory exists', () => {
      fs.existsSync.mockImplementation((path) => {
        return path.endsWith('waha');
      });
      expect(WhatsAppGatewayRunner.getActiveGatewayType()).toBe('waha');
    });

    it('should return evolution if evolution-api directory exists and waha does not', () => {
      fs.existsSync.mockImplementation((path) => {
        return path.endsWith('evolution-api');
      });
      expect(WhatsAppGatewayRunner.getActiveGatewayType()).toBe('evolution');
    });

    it('should return null if neither directory exists', () => {
      fs.existsSync.mockReturnValue(false);
      expect(WhatsAppGatewayRunner.getActiveGatewayType()).toBeNull();
    });
  });

  describe('isInstalled', () => {
    it('should return true if a directory exists', () => {
      fs.existsSync.mockImplementation((path) => {
        return path.endsWith('waha');
      });
      expect(WhatsAppGatewayRunner.isInstalled()).toBe(true);
    });

    it('should return false if no directories exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(WhatsAppGatewayRunner.isInstalled()).toBe(false);
    });
  });

  describe('isCompiled', () => {
    it('should return true if waha is active and main.js exists', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('waha')) return true;
        if (p.endsWith('main.js') && !p.includes('evolution-api')) return true;
        return false;
      });
      expect(WhatsAppGatewayRunner.isCompiled()).toBe(true);
    });

    it('should return false if waha is active and main.js is missing', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('waha')) return true;
        return false;
      });
      expect(WhatsAppGatewayRunner.isCompiled()).toBe(false);
    });

    it('should return true if evolution is active and main.js exists', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('evolution-api')) return true;
        if (p.endsWith('main.js') && p.includes('evolution-api')) return true;
        return false;
      });
      expect(WhatsAppGatewayRunner.isCompiled()).toBe(true);
    });

    it('should return false if evolution is active and main.js is missing', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('evolution-api')) return true;
        return false;
      });
      expect(WhatsAppGatewayRunner.isCompiled()).toBe(false);
    });

    it('should return false if no gateway is active', () => {
      fs.existsSync.mockReturnValue(false);
      expect(WhatsAppGatewayRunner.isCompiled()).toBe(false);
    });
  });

  describe('start', () => {
    it('should return false if no gateway directory is installed', () => {
      fs.existsSync.mockReturnValue(false);
      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:8080', apiKey: 'key' });
      expect(res).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should return false if waha is active but not compiled', () => {
      fs.existsSync.mockImplementation((p) => {
        return p.endsWith('waha');
      });

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'key' });
      expect(res).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should return false if evolution is active but not compiled', () => {
      fs.existsSync.mockImplementation((p) => {
        return p.endsWith('evolution-api');
      });

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:8080', apiKey: 'key' });
      expect(res).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should return true immediately if process is already running', () => {
      fs.existsSync.mockImplementation(() => true);
      global.evolutionApiProcess = mockChildProcess;

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:8080', apiKey: 'key' });
      expect(res).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should spawn WAHA child process with correct config and environment variables', () => {
      fs.existsSync.mockImplementation(() => true); // WAHA is active (waha exists) and compiled (main.js exists)

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'waha-key' });
      expect(res).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.stringContaining('dist' + path.sep + 'main.js')],
        expect.objectContaining({
          cwd: expect.stringContaining('waha'),
          env: expect.objectContaining({
            PORT: '3000',
            WHATSAPP_API_KEY: 'waha-key',
            WAHA_API_KEY: 'waha-key',
            WAHA_SECURITY_API_KEY: 'waha-key',
            WHATSAPP_DEFAULT_ENGINE: 'WEBJS'
          }),
          shell: true
        })
      );
      expect(global.evolutionApiProcess).toBe(mockChildProcess);
    });

    it('should spawn Evolution API child process if evolution is active and compiled', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('waha')) return false; // waha not active
        return true; // evolution is active and compiled
      });

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:8080', apiKey: 'evo-key' });
      expect(res).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.stringContaining('evolution-api')],
        expect.objectContaining({
          cwd: expect.stringContaining('evolution-api'),
          env: expect.objectContaining({
            PORT: '8080',
            SERVER_PORT: '8080',
            AUTH_API_KEY: 'evo-key',
            AUTHENTICATION_API_KEY: 'evo-key',
            DATABASE_ENABLED: 'true'
          }),
          shell: true
        })
      );
    });

    it('should spawn Evolution API child process with empty/missing url and apiKey', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('waha')) return false; // waha not active
        return true; // evolution is active and compiled
      });

      const res = WhatsAppGatewayRunner.start({ url: '', apiKey: '' });
      expect(res).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.stringContaining('evolution-api')],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8080',
            SERVER_PORT: '8080',
            SERVER_URL: 'http://localhost:8080',
            AUTH_API_KEY: '',
            AUTHENTICATION_API_KEY: ''
          })
        })
      );
    });

    it('should parse port from config URL correctly', () => {
      fs.existsSync.mockImplementation(() => true);

      WhatsAppGatewayRunner.start({ url: 'http://127.0.0.1:9000', apiKey: 'mykey' });
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.any(String)],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '9000'
          })
        })
      );
    });

    it('should fallback to default WAHA port 3000 if URL has no port and WAHA is active', () => {
      fs.existsSync.mockImplementation(() => true);

      WhatsAppGatewayRunner.start({ url: 'http://localhost', apiKey: 'mykey' });
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.any(String)],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000'
          })
        })
      );
    });

    it('should set fallback default WAHA port 3000 if URL is empty and WAHA is active', () => {
      fs.existsSync.mockImplementation(() => true);

      WhatsAppGatewayRunner.start({ url: '', apiKey: 'mykey' });
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.any(String)],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000'
          })
        })
      );
    });

    it('should spawn WAHA process with empty apiKey if not provided', () => {
      fs.existsSync.mockImplementation(() => true);

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: '' });
      expect(res).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.any(String)],
        expect.objectContaining({
          env: expect.objectContaining({
            WHATSAPP_API_KEY: '',
            WAHA_API_KEY: '',
            WAHA_SECURITY_API_KEY: ''
          })
        })
      );
    });

    it('should register listeners for stdout, stderr, close and error events', () => {
      fs.existsSync.mockImplementation(() => true);

      WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'key' });

      expect(mockChildProcess.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockChildProcess.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Trigger stdout data listener
      const stdoutListener = mockChildProcess.stdout.on.mock.calls[0][1];
      stdoutListener(Buffer.from('WAHA starting\n'));
      stdoutListener(Buffer.from('')); // empty output coverage

      // Trigger stderr data listener
      const stderrListener = mockChildProcess.stderr.on.mock.calls[0][1];
      stderrListener(Buffer.from('WAHA browser error\n'));
      stderrListener(Buffer.from('')); // empty error output coverage

      // Trigger error event listener
      const errorListener = mockChildProcess.on.mock.calls.find(c => c[0] === 'error')[1];
      errorListener(new Error('Process failed'));
      expect(global.evolutionApiProcess).toBeNull();

      // Trigger close event listener (re-start to mock another listener)
      global.evolutionApiProcess = mockChildProcess;
      const closeListener = mockChildProcess.on.mock.calls.find(c => c[0] === 'close')[1];
      closeListener(0);
      expect(global.evolutionApiProcess).toBeNull();
    });

    it('should return false and log error if spawning throws exception', () => {
      fs.existsSync.mockImplementation(() => true);
      spawn.mockImplementation(() => {
        throw new Error('Fatal Spawn Error');
      });

      const res = WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'key' });
      expect(res).toBe(false);
      expect(global.evolutionApiProcess).toBeNull();
    });
  });

  describe('stop', () => {
    it('should return false if no process is currently running', () => {
      const res = WhatsAppGatewayRunner.stop();
      expect(res).toBe(false);
    });

    it('should terminate the process using taskkill if running on Windows (win32)', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      fs.existsSync.mockImplementation(() => true);
      
      WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'key' });
      const res = WhatsAppGatewayRunner.stop();

      expect(res).toBe(true);
      expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', 1234, '/f', '/t']);
      expect(global.evolutionApiProcess).toBeNull();
    });

    it('should terminate the process using SIGTERM if running on other platforms (e.g. linux)', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fs.existsSync.mockImplementation(() => true);

      WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'key' });
      const res = WhatsAppGatewayRunner.stop();

      expect(res).toBe(true);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(global.evolutionApiProcess).toBeNull();
    });

    it('should return false if terminate throws exception', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fs.existsSync.mockImplementation(() => true);

      WhatsAppGatewayRunner.start({ url: 'http://localhost:3000', apiKey: 'key' });
      mockChildProcess.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      const res = WhatsAppGatewayRunner.stop();
      expect(res).toBe(false);
    });
  });

  describe('registerExitHandlers', () => {
    it('should have registered exit, SIGINT, SIGTERM, and uncaughtException handlers', () => {
      expect(capturedExitHandlers['exit']).toBeInstanceOf(Function);
      expect(capturedExitHandlers['SIGINT']).toBeInstanceOf(Function);
      expect(capturedExitHandlers['SIGTERM']).toBeInstanceOf(Function);
      expect(capturedExitHandlers['uncaughtException']).toBeInstanceOf(Function);
    });

    it('should do nothing on exit event if no subprocess is running', () => {
      global.evolutionApiProcess = null;
      const { execSync } = require('child_process');
      const exitHandler = capturedExitHandlers['exit'];
      expect(exitHandler).toBeDefined();

      expect(() => exitHandler()).not.toThrow();
      expect(execSync).not.toHaveBeenCalled();
    });

    it('should terminate subprocess on exit event (Windows - win32)', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const { execSync } = require('child_process');
      
      global.evolutionApiProcess = mockChildProcess;

      const exitHandler = capturedExitHandlers['exit'];
      expect(exitHandler).toBeDefined();

      exitHandler();

      expect(execSync).toHaveBeenCalledWith('taskkill /pid 1234 /f /t', expect.any(Object));
      expect(global.evolutionApiProcess).toBeNull();
    });

    it('should terminate subprocess on exit event (Linux)', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      
      global.evolutionApiProcess = mockChildProcess;

      const exitHandler = capturedExitHandlers['exit'];
      exitHandler();

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(global.evolutionApiProcess).toBeNull();
    });

    it('should handle exception during exit handler gracefully', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      
      global.evolutionApiProcess = mockChildProcess;
      mockChildProcess.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      const exitHandler = capturedExitHandlers['exit'];
      expect(() => exitHandler()).not.toThrow();
    });

    it('should handle SIGINT by killing process and calling process.exit(0)', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      global.evolutionApiProcess = mockChildProcess;

      const sigintHandler = capturedExitHandlers['SIGINT'];
      sigintHandler();

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle SIGTERM by killing process and calling process.exit(0)', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      global.evolutionApiProcess = mockChildProcess;

      const sigtermHandler = capturedExitHandlers['SIGTERM'];
      sigtermHandler();

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle uncaughtException by killing process and calling process.exit(1)', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      global.evolutionApiProcess = mockChildProcess;

      const exceptionHandler = capturedExitHandlers['uncaughtException'];
      exceptionHandler(new Error('Fatal Error'));

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
