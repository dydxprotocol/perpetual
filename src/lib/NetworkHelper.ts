export function isDevNetwork() {
  return [
    '1001',
    '1002',
  ].includes(process.env.NETWORK_ID);
}
