const { setupMikrotikTerminalWs, handleTerminalSession } = require('../services/mikrotikTerminalService');
const mikrotikService = require('../services/mikrotikService');
const EventEmitter = require('events');

describe('mikrotikTerminalService', () => {
  let mockServer;
  let mockSessionMiddleware;

  beforeEach(() => {
    mockServer = new EventEmitter();
    mockSessionMiddleware = jest.fn((req, res, next) => next());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('setupMikrotikTerminalWs should register upgrade listener on server', () => {
    const wss = setupMikrotikTerminalWs(mockServer, mockSessionMiddleware);
    expect(wss).toBeDefined();
    expect(mockServer.listenerCount('upgrade')).toBeGreaterThan(0);
  });

  test('upgrade listener should ignore non-terminal URLs', () => {
    setupMikrotikTerminalWs(mockServer, mockSessionMiddleware);
    const mockSocket = { write: jest.fn(), destroy: jest.fn() };
    const req = { url: '/some/other/websocket', headers: { host: 'localhost' } };

    mockServer.emit('upgrade', req, mockSocket, Buffer.from(''));
    expect(mockSocket.write).not.toHaveBeenCalled();
    expect(mockSocket.destroy).not.toHaveBeenCalled();
  });

  test('upgrade listener should reject unauthenticated requests with 401', () => {
    const unauthSessionMiddleware = (req, res, next) => {
      req.session = {}; // No admin property
      next();
    };
    setupMikrotikTerminalWs(mockServer, unauthSessionMiddleware);
    const mockSocket = { write: jest.fn(), destroy: jest.fn() };
    const req = { url: '/admin/ws/routers/1/terminal', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' } };

    mockServer.emit('upgrade', req, mockSocket, Buffer.from(''));
    expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('401 Unauthorized'));
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  test('handleTerminalSession should send error if router not found in database', () => {
    jest.spyOn(mikrotikService, 'getRouterById').mockReturnValue(null);
    const mockWs = {
      readyState: 1, // OPEN
      OPEN: 1,
      send: jest.fn(),
      close: jest.fn()
    };
    const mockReq = { session: { admin: { username: 'superadmin' } } };

    handleTerminalSession(mockWs, mockReq, 9999);
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('Router dengan ID #9999 tidak ditemukan'));
    expect(mockWs.close).toHaveBeenCalled();
  });
});
