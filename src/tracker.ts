import * as crypto from "crypto"
import * as dgram from "dgram"
import { getLogger } from "log4js"
import { URL } from "url"
import { TorrentParser } from "./torrent-parser"
import * as utils from "./utils"

// tslint:disable-next-line: no-empty
const noop = () => {}
const logger = getLogger("getPeers")

export async function getAllPeers(torrentParser: TorrentParser) {
    const urls = torrentParser.urls()
    logger.info(`Get ${urls.length} trarkers, going to request to all of them`)
    const peers = []

    let count = 0
    await new Promise( (resolve) => {
        urls.forEach( async (url) => {
            try {
                const res = await getPeers(url, torrentParser.infoHash(), torrentParser.size(), 15 * 1000)
                for (const peer of res.peers) {
                    peers.push(peer)
                }
            } catch (e) {
                logger.warn(e)
            } finally {
                count += 1
                if ( count === urls.length ) {
                    resolve()
                }
            }
        })
    })

    if (peers.length === 0) {
        throw new Error("There are no peers info returned")
    }

    const uniquePeers = utils.removeDuplicats(peers)
    logger.info(`unique peers ${uniquePeers.length}`)

    for (let i = 0 ; i < uniquePeers.length; i++) {
        logger.debug(`peer ${i} => ${uniquePeers[i].ip}:${uniquePeers[i].port}`)
    }
    return peers
}

// initial tiemout should be 15 seconds, n should be 1, repeat 2 times.
// tslint:disable-next-line: max-line-length
export async function getPeers(url: string, infoHash: Buffer, size: Buffer, timeout: number, n: number = 1) {
    const socket = dgram.createSocket("udp4")
    logger.info(`GetPeers ===> from tracker ${url} ===> the No.${n} times request with timeout: ${timeout / 1000} seconds`)

    try {
        return await new Promise<any>( (resolved, rejected) => {
            setTimeout( () => rejected("Timeout"), timeout)
            udpSend(socket, buildConnReq(), url, () => {
                logger.debug("sent build connecting udp request")
            })
            socket.on("message", (res) => {
                if (respTyoe(res) === "connect") {
                    logger.debug("receive connect response")
                    const connResp = parseConnResp(res)
                    const announceReq = buildAnnounceReq(connResp.connectionId, infoHash, size)
                    udpSend(socket, announceReq, url, () => {
                        logger.debug("sent announce udp request")
                    })
                } else if (respTyoe(res) === "announce") {
                    logger.debug("receive announce response")
                    const announceResp = parseAnnounceResp(res)
                    resolved(announceResp)
                }
            })
        })
    } catch (e) {
        if ( e === "Timeout" && n === 1) {
            return getPeers(url, infoHash, size, timeout * 2 , n + 1 )
        } else {
            throw e
        }
    } finally {
        socket.close()
    }
}

function udpSend(socket, message, rawUrl, callback = noop) {
    logger.debug(`rawUrl is ${rawUrl}`)
    const url = new URL(rawUrl)
    logger.debug(`sent to ${url.hostname}:${url.port}`)
    socket.send(message, 0, message.length, Number(url.port), url.hostname, callback)
}

function respTyoe(res: Buffer): string {
    const action = res.readInt32BE(0)
    if (action === 0 ) { return "connect" }
    if (action === 1 ) { return "announce" }
}

// Offset  Size            Name            Value
// 0       64-bit integer  connection_id   0x41727101980 (constant)
// 8       32-bit integer  action          0 // connect
// 12      32-bit integer  transaction_id  ? // random
// 16 Byte Total
function buildConnReq(): Buffer {
    // Buffer.alloc will initial the buffer with 0 but slightly slower than
    // Buffer.allocUnsafe which will not initialize buffer
    const buf = Buffer.alloc(16)
    buf.writeUInt32BE(0x417, 0)
    buf.writeUInt32BE(0x27101980, 4)

    buf.writeUInt32BE(0, 8)

    crypto.randomBytes(4).copy(buf, 12)

    return buf
}

// Offset  Size            Name            Value
// 0       32-bit integer  action          0 // connect
// 4       32-bit integer  transaction_id
// 8       64-bit integer  connection_id
// 16 Byte Total
function parseConnResp(res: Buffer) {
    return {
        action: res.readUInt32BE(0),
        transactionId: res.readUInt32BE(4),
        // tslint:disable-next-line: object-literal-sort-keys
        connectionId: res.slice(8),
    }
}

// Offset  Size    Name    Value
// 0       64-bit integer  connection_id // returned by connecting message
// 8       32-bit integer  action          1 // announce
// 12      32-bit integer  transaction_id // random
// 16      20-byte string  info_hash // torrentParser info_hash()
// 36      20-byte string  peer_id // a random 20-byte string but there is a convention
// 56      64-bit integer  downloaded // 0
// 64      64-bit integer  left // torrentParser size()
// 72      64-bit integer  uploaded // 0
// 80      32-bit integer  event           0 // 0: none; 1: completed; 2: started; 3: stopped
// 84      32-bit integer  IP address      0 // default
// 88      32-bit integer  key             ? // random
// 92      32-bit integer  num_want        -1 // default
// 96      16-bit integer  port            ? // should be betwee 6881 to 6889
// 98 Byte Total
function buildAnnounceReq(connId: Buffer, infoHash: Buffer, size: Buffer, port = 6881): Buffer {
    // allocate 98 Byte buffer without initilize
    const buf = Buffer.allocUnsafe(98)
    // connection_id 8 Bytes
    connId.copy(buf, 0)
    // action 4 Bytes
    buf.writeUInt32BE(1, 8)
    // transaction_id 4 Bytes
    crypto.randomBytes(4).copy(buf, 12)
    // info_hash 20 Bytes
    infoHash.copy(buf, 16)
    // peer_id 20 Bytes
    utils.getId().copy(buf, 36)
    // downloaded 8 Bytes
    Buffer.alloc(8).copy(buf, 56)
    // left 8 Bytes
    size.copy(buf, 64)
    // uploaded 8 Bytes
    Buffer.alloc(8).copy(buf, 72)
    // event 4 Bytes
    buf.writeUInt32BE(0, 80)
    // ip-address 4 Bytes
    buf.writeUInt32BE(0, 84)
    // key 4 Btyes
    crypto.randomBytes(4).copy(buf, 88)
    // num_want 4 Bytes
    buf.writeInt32BE(-1, 92)
    buf.writeUInt16BE(port, 96)
    return buf
}

// Offset      Size            Name            Value
// 0           32-bit integer  action          1 // announce
// 4           32-bit integer  transaction_id
// 8           32-bit integer  interval
// 12          32-bit integer  leechers
// 16          32-bit integer  seeders
// 20 + 6 * n  32-bit integer  IP address
// 24 + 6 * n  16-bit integer  TCP port
// 20 + 6 * N
function parseAnnounceResp(res: Buffer) {
    return {
        action: res.readUInt32BE(0),
        transactionId: res.readUInt32BE(4),
        // tslint:disable-next-line: object-literal-sort-keys
        interval: res.readUInt32BE(8),
        leechers: res.readUInt32BE(12),
        seeders: res.readUInt32BE(16),
        peers: utils.group(res.slice(20), 6).map( (ele) => {
            return {
                ip: ele.slice(0, 4).join("."),
                port: ele.readUInt16BE(4),
            }
        }),
    }
}
