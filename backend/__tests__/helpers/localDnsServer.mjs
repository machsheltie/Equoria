/**
 * A tiny authoritative DNS server on 127.0.0.1, for tests that must exercise the
 * real Node resolver path (c-ares, `dns.promises.resolve4/resolve6`) without
 * depending on the public internet (Equoria-l2ij4).
 *
 * The genuine third-party network boundary is the upstream resolver. Everything
 * Equoria owns (the SSRF gate's resolution, per-address re-validation and
 * fail-closed behaviour) keeps running unchanged against real resolver calls;
 * only the answers come from this process instead of the network.
 *
 * Answers A and AAAA questions for the configured names; any other type for a
 * known name is NOERROR with no answers (NODATA); an unknown name is NXDOMAIN.
 * UDP only, one question per packet: all a stub resolver needs here.
 *
 * Usage:
 *   const dnsServer = await startLocalDnsServer({ 'example.com': ['93.184.216.34'] });
 *   dnsPromises.setServers([`127.0.0.1:${dnsServer.port}`]);
 *   ... run assertions ...
 *   dnsPromises.setServers(previousServers);
 *   await dnsServer.close();
 */

import dgram from 'node:dgram';
import net from 'node:net';

const TYPE_A = 1;
const TYPE_AAAA = 28;
const CLASS_IN = 1;
const HEADER_LENGTH = 12;

/** Parse the first question: its QNAME, QTYPE and the byte offset just past it. */
function parseQuestion(message) {
  const labels = [];
  let offset = HEADER_LENGTH;
  while (offset < message.length && message[offset] !== 0) {
    const length = message[offset];
    labels.push(message.toString('ascii', offset + 1, offset + 1 + length));
    offset += length + 1;
  }
  const name = labels.join('.').toLowerCase();
  const type = message.readUInt16BE(offset + 1);
  return { name, type, end: offset + 5 };
}

function encodeAddress(address) {
  if (net.isIPv4(address)) {
    return Buffer.from(address.split('.').map(Number));
  }
  // Only fully-written IPv6 literals (8 groups) are needed by the tests.
  const groups = address.split(':');
  if (groups.length !== 8) {
    throw new Error(`localDnsServer: write the IPv6 address out in full (8 groups): ${address}`);
  }
  const out = Buffer.alloc(16);
  groups.forEach((group, index) => out.writeUInt16BE(Number.parseInt(group, 16), index * 2));
  return out;
}

function buildResponse(message, records) {
  const { name, type, end } = parseQuestion(message);
  const known = Object.hasOwn(records, name);
  const wantFamily = type === TYPE_A ? 4 : type === TYPE_AAAA ? 6 : 0;
  const answers =
    known && wantFamily ? records[name].filter(address => net.isIP(address) === wantFamily) : [];

  const header = Buffer.alloc(HEADER_LENGTH);
  message.copy(header, 0, 0, 2); // echo the query id
  header.writeUInt16BE(0x8180 | (known ? 0 : 3), 2); // response + RD + RA, rcode NXDOMAIN when unknown
  header.writeUInt16BE(1, 4); // QDCOUNT
  header.writeUInt16BE(answers.length, 6); // ANCOUNT

  const question = message.subarray(HEADER_LENGTH, end);
  const answerBuffers = answers.map(address => {
    const rdata = encodeAddress(address);
    const record = Buffer.alloc(12 + rdata.length);
    record.writeUInt16BE(0xc00c, 0); // name: pointer to the question name
    record.writeUInt16BE(type, 2);
    record.writeUInt16BE(CLASS_IN, 4);
    record.writeUInt32BE(60, 6); // TTL
    record.writeUInt16BE(rdata.length, 10);
    rdata.copy(record, 12);
    return record;
  });
  return Buffer.concat([header, question, ...answerBuffers]);
}

/**
 * @param {Record<string, string[]>} records lowercase hostname -> addresses
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startLocalDnsServer(records) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (message, remote) => {
    if (message.length <= HEADER_LENGTH) {
      return;
    }
    socket.send(buildResponse(message, records), remote.port, remote.address);
  });
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(0, '127.0.0.1', resolve);
  });
  return {
    port: socket.address().port,
    close: () => new Promise(resolve => socket.close(resolve)),
  };
}
