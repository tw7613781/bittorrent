import * as crypto from "crypto"
import { getLogger } from "log4js"

const logger = getLogger("utils")

export function group(buf: Buffer, groupSize): Buffer[] {
    const groups = []
    let i
    for (i = 0; i < buf.length; i += groupSize) {
        groups.push(buf.slice(i, i + groupSize))
    }
    return groups
}

// remove duplicated IP and zero IP
export function sanitizeIP(peers) {
    // tslint:disable-next-line: max-line-length
    return peers.filter( (peer, index, self) => {
        return index === self.findIndex( (p) => p.ip === peer.ip && p.port === peer.port ) && peer.ip !== "0.0.0.0"
    })
}
