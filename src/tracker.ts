import * as dgram from "dgram"
import { URL } from "url"

// tslint:disable-next-line: no-empty
const noop = () => {}

export function getPeers(torrent, callback) {
    const socket = dgram.createSocket("udp4")
    const url = torrent.announce.toString("utf8")

    udpSend(socket, buildConnReq(), url)

    socket.on("message", (res) => {
        if (respTyoe(res) === "connect") {
            const connResp = parseConnResp(res)
            const announceReq = buildAnnounceReq(connResp.connectionId)
            udpSend(socket, announceReq, url)
        } else if (respTyoe(res) === "announce") {
            const announceResp = parseAnnounceResp(res)
            callback(announceResp)
        }
    })
}

function udpSend(socket, message, rawUrl, callback = noop) {
    const url = new URL(rawUrl)
    socket.send(message, 0, message.length, Number(url.port), url.port, callback)
}

function buildConnReq() {
    // TODO
}

function respTyoe(res) {
    // TODO
    return "something"
}

function parseConnResp(res) {
    // TODO
}

function buildAnnounceReq(connId) {
    // TODO
}

function parseAnnounceResp(res) {
    // TODO
}