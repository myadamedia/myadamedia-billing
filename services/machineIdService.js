/**
 * Machine ID Service - Generates hardware fingerprint for local server
 * Used for binding one-time lifetime license to a specific machine/server.
 */
const os = require('os');
const crypto = require('crypto');

/**
 * Get primary network interface MAC address
 */
function getMacAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac.toLowerCase();
      }
    }
  }
  return '00:11:22:33:44:55'; // Fallback
}

/**
 * Get CPU info summary
 */
function getCpuSummary() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return 'generic-cpu';
  const model = cpus[0].model || 'unknown-model';
  const count = cpus.length;
  return `${model}-${count}`;
}

/**
 * Generate formatted Machine ID
 * Output format: MYADA-XXXX-XXXX-XXXX-XXXX (16 uppercase hex chars grouped in 4s)
 */
function getMachineId() {
  const rawString = [
    getMacAddress(),
    getCpuSummary(),
    os.platform(),
    os.arch(),
    os.hostname()
  ].join('|');

  const hash = crypto.createHash('sha256').update(rawString).digest('hex').toUpperCase();
  const part1 = hash.substring(0, 4);
  const part2 = hash.substring(4, 8);
  const part3 = hash.substring(8, 12);
  const part4 = hash.substring(12, 16);

  return `MYADA-${part1}-${part2}-${part3}-${part4}`;
}

module.exports = {
  getMachineId,
  getMacAddress,
  getCpuSummary
};
