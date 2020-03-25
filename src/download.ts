import { getLogger } from "log4js"
import * as net from "net"

const logger = getLogger("download")

export function download(peer) {
    const socket = new net.Socket()
    socket.on("error", (err) => {
        logger.warn(err)
    })
    socket.connect( peer.port, peer.ip, () => {
        logger.info(`connected with ${peer.ip}:${peer.port}`)
    })
    onWholeMsg(socket, (data: Buffer) => {
        logger.info(data)
    })
}

function onWholeMsg(socket, callback) {
    let savedBuf = Buffer.alloc(0)
    let handshake = true

    socket.on("data", ( recvBuf) => {
        // closures
        const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readUInt32BE(0) + 4
        savedBuf = Buffer.concat([savedBuf, recvBuf])

        while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
            callback(savedBuf.slice(0, msgLen()))
            savedBuf = savedBuf.slice(msgLen())
            handshake = false
        }
    })
}
