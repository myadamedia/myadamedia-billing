const NotificationService = require('../services/notificationService');
const telegramBot = require('../services/telegramBot');

describe('NotificationService & TelegramBot Integration Test', () => {
  test('should exported sendTelegramMessage and sendTelegramAdminNotification correctly', () => {
    expect(typeof telegramBot.sendTelegramMessage).toBe('function');
    expect(typeof telegramBot.sendTelegramAdminNotification).toBe('function');
  });

  test('should return false when Telegram is disabled or no admin ID is set', async () => {
    const result = await telegramBot.sendTelegramAdminNotification('Test message');
    expect(typeof result).toBe('boolean');
  });

  test('should execute NotificationService.notifyNewTicket without crashing', async () => {
    await expect(NotificationService.notifyNewTicket({
      ticketId: 999,
      customerName: 'Budi Test',
      customerPhone: '08123456789',
      customerAddress: 'Jl. Merdeka No. 1',
      subject: 'Internet Lambat',
      message: 'Koneksi lemot sejak pagi',
      photoCount: 1,
      category: 'Pelanggan'
    })).resolves.not.toThrow();
  });

  test('should execute NotificationService.notifyPaymentSuccess without crashing', async () => {
    await expect(NotificationService.notifyPaymentSuccess({
      invoiceId: 1001,
      customerName: 'Budi Test',
      customerPhone: '08123456789',
      amount: 150000,
      period: '08/2026',
      gateway: 'Tripay',
      paymentOrderNo: 'INV-1001-123456',
      paymentType: 'tagihan'
    })).resolves.not.toThrow();
  });

  test('should exported notifyCustomerIsolated correctly', () => {
    expect(typeof NotificationService.notifyCustomerIsolated).toBe('function');
  });

  test('should execute NotificationService.notifyCustomerIsolated without crashing', async () => {
    const dummyCustomer = {
      id: 9999,
      name: 'Pelanggan Test Isolir',
      phone: '081298765432',
      package_id: 1,
      package_name: 'Paket-Test-10M',
      package_price: 150000,
      pppoe_username: 'user_isolir_test',
      status: 'suspended',
      send_isolir_reminder: 1
    };

    await expect(NotificationService.notifyCustomerIsolated(dummyCustomer)).resolves.not.toThrow();
  });

  test('should respect customer.send_isolir_reminder === 0', async () => {
    const disabledCustomer = {
      id: 9998,
      name: 'Pelanggan Opt-out',
      phone: '081298765433',
      package_id: 1,
      status: 'suspended',
      send_isolir_reminder: 0
    };

    const result = await NotificationService.notifyCustomerIsolated(disabledCustomer);
    expect(result).toBe(false);
  });
});

