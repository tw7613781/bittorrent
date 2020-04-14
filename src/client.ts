import * as crypto from "crypto"
import * as dgram from "dgram"
import * as fs from "fs"
import { getLogger } from "log4js"
import * as net from "net"
import { URL } from "url"
import { Message } from "./message"
import { Pieces } from "./pieces"
import { Queue } from "./queue"
import { TorrentParser } from "./torrent-parser"
import * as utils from "./utils"

// tslint:disable-next-line: no-empty
const noop = () => {}
const logger = getLogger("getPeers")

// GL stands for Glosfer, 0001 is the version
const clientName = "-GL0001-"

export class Client {

    private id: Buffer
    private torrentParser: TorrentParser

    constructor(torrentParser: TorrentParser) {
        this.id = this.getId()
        this.torrentParser = torrentParser
    }

    public getId() {
        if (this.id === undefined) {
            this.id = crypto.randomBytes(20)
            Buffer.from(clientName).copy(this.id, 0)
        }
        return this.id
    }

    public async downloadAll(message: Message, path) {
        // The torrent.info.pieces is a buffer that contains 20-byte SHA-1 hash of each piece
        const pieces = new Pieces(this.torrentParser)
        const file = fs.openSync(path, "w")
        const peers = await this.getAllPeers()
        peers.forEach( (peer) => {
            this.download(peer, message, pieces, file)
        })
    }

    private download(peer, message, pieces, file) {
        const socket = new net.Socket()
        socket.on("error", (err) => {
            logger.warn(err)
        })
        socket.connect( peer.port, peer.ip, () => {
            logger.info(`connected with ${peer.ip}:${peer.port}`)
            socket.write(message.buildHandshake())
        })
        const queue = new Queue(this.torrentParser)
        this.onWholeMsg(socket, (data: Buffer) => {
             this.msgHandler(data, socket, pieces, queue, message, file)
        })
    }

    private async getAllPeers() {
        const urls = this.torrentParser.urls()
        logger.info(`Get ${urls.length} trarkers, going to request to all of them`)
        const peers = []

        let count = 0
        await new Promise( (resolve) => {
            urls.forEach( async (url) => {
                try {
                    // tslint:disable-next-line: max-line-length
                    const res = await this.getPeers(url, this.torrentParser.infoHash(), this.torrentParser.size(), 15 * 1000)
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
    private async getPeers(url: string, infoHash: Buffer, size: Buffer, timeout: number, n: number = 1) {
        const socket = dgram.createSocket("udp4")
        logger.info(`GetPeers ===> from tracker ${url} ===> the No.${n} times request with timeout: ${timeout / 1000} seconds`)

        try {
            return await new Promise<any>( (resolved, rejected) => {
                setTimeout( () => rejected("Timeout"), timeout)
                this.udpSend(socket, this.buildConnReq(), url, () => {
                    logger.debug("sent build connecting udp request")
                })
                socket.on("message", (res) => {
                    if (this.respTyoe(res) === "connect") {
                        logger.debug("receive connect response")
                        const connResp = this.parseConnResp(res)
                        const announceReq = this.buildAnnounceReq(connResp.connectionId, infoHash, size)
                        this.udpSend(socket, announceReq, url, () => {
                            logger.debug("sent announce udp request")
                        })
                    } else if (this.respTyoe(res) === "announce") {
                        logger.debug("receive announce response")
                        const announceResp = this.parseAnnounceResp(res)
                        resolved(announceResp)
                    }
                })
            })
        } catch (e) {
            if ( e === "Timeout" && n === 1) {
                return this.getPeers(url, infoHash, size, timeout * 2 , n + 1 )
            } else {
                throw e
            }
        } finally {
            socket.close()
        }
    }

    private udpSend(socket, message, rawUrl, callback = noop) {
        logger.debug(`rawUrl is ${rawUrl}`)
        const url = new URL(rawUrl)
        logger.debug(`sent to ${url.hostname}:${url.port}`)
        socket.send(message, 0, message.length, Number(url.port), url.hostname, callback)
    }

    private respTyoe(res: Buffer): string {
        const action = res.readInt32BE(0)
        if (action === 0 ) { return "connect" }
        if (action === 1 ) { return "announce" }
    }

    // Offset  Size            Name            Value
    // 0       64-bit integer  connection_id   0x41727101980 (constant)
    // 8       32-bit integer  action          0 // connect
    // 12      32-bit integer  transaction_id  ? // random
    // 16 Byte Total
    private buildConnReq(): Buffer {
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
    private parseConnResp(res: Buffer) {
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
    private buildAnnounceReq(connId: Buffer, infoHash: Buffer, size: Buffer, port = 6881): Buffer {
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
        this.getId().copy(buf, 36)
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
    private parseAnnounceResp(res: Buffer) {
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

    private async onWholeMsg(socket, callback) {
        let savedBuf = Buffer.alloc(0)
        let handshake = true
        socket.on("data", (recvBuf) => {
            // msgLen calculates the length of a whole message
            const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4
            savedBuf = Buffer.concat([savedBuf, recvBuf])
            while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
                    callback(savedBuf.slice(0, msgLen()))
                    savedBuf = savedBuf.slice(msgLen())
                    handshake = false
                }
          })
    }

    private msgHandler(data, socket, pieces, queue, message, file) {
        if (this.isHandshake(data)) {
            socket.write(message.buildInterested())
        } else {
            const m = this.parse(data)
            if (m.id === 0) { this.chokeHandler(socket) }
            if (m.id === 1) { this.unchokeHandler(socket, pieces, queue, message) }
            if (m.id === 4) { this.haveHandler(socket, pieces, queue, m.payload, message) }
            if (m.id === 5) { this.bitfieldHandler(socket, pieces, queue, m.payload, message) }
            if (m.id === 7) { this.pieceHandler(socket, pieces, queue, message, file, m.payload) }
        }
    }

    private isHandshake(msg) {
        return msg.length === msg.readUInt8(0) + 49 && msg.toString("uft8", 1, 20) === "BitTorrent protocol"
    }

    private parse(msg) {
        const id = msg.length > 4 ? msg.readUInt8(4) : undefined
        let payload = msg.legnth > 5 ? msg.slice(5) : undefined
        if (id === 6 || id === 7 || id === 8) {
            const rest = payload.slice(8)
            payload = {
                index: payload.readInt32BE(0),
                // tslint:disable-next-line: object-literal-sort-keys
                begin: payload.readInt32BE(4),
            }
            payload[id === 7 ? "block" : "length"] = rest
        }

        return {
            size: msg.readInt32BE(0),
            // tslint:disable-next-line: object-literal-sort-keys
            id,
            payload,
        }
    }

    private chokeHandler(socket) {
        socket.end()
    }

    private unchokeHandler(socket, pieces, queue, message) {
        queue.choked = false
        this.requestPiece(socket, pieces, queue, message)
    }

    private haveHandler(socket, pieces, queue, payload: Buffer, message: Message) {
        const pieceIndex = payload.readUInt32BE(0)
        const queueEmpty = queue.length === 0
        queue.queue(pieceIndex)
        if (queueEmpty) {
            this.requestPiece(socket, message, pieces, queue)
        }
    }

    private bitfieldHandler(socket, pieces, queue, payload: Buffer, message: Message) {
        const queueEmpty = queue.length === 0
        payload.forEach( (byte, i) => {
            for (let j = 0; j < 8; j++) {
                if (byte % 2) { queue.queue(i * 8 + 7 - j) }
                byte = Math.floor(byte / 2)
            }
        })
        if (queueEmpty) { this.requestPiece(socket, message, pieces, queue) }
    }

    private pieceHandler(socket, pieces, queue, message, file, pieceResp) {
        pieces.printPercentDone()
        pieces.addReceived(pieceResp)

        const offset = pieceResp.index * this.torrentParser.torrent.info["piece length"] + pieceResp.begin
        fs.write(file, pieceResp.block, 0, pieceResp.block.length, offset, () => {
            logger.debug("write to file")
        })

        if (pieces.isDone()) {
            socket.end()
            logger.info("Done")
            try {
                fs.closeSync(file)
            } catch (e) {
                logger.error(e)
            }
        } else {
            this.requestPiece(socket, message, pieces, queue)
        }
    }

    private requestPiece(socekt, message, pieces, queue) {
        if (queue.choked) { return undefined }
        while (queue.length()) {
            const pieceBlock = queue.deque()
            if (pieces.needed(pieceBlock)) {
                socekt.write(message.buildRequest(pieceBlock))
                pieces.addRequested(pieceBlock)
                break
            }
        }
    }
}
