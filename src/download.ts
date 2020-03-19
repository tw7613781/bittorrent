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
    socket.on("data", (data) => {
        logger.info(data)
    })
}
