import { Client } from "./client"
import { TorrentParser } from "./torrent-parser"

export class Message {

    public client: Client

    constructor(client: Client) {
        this.client = client
    }

    // Offset  Size            Name            Value
    // 0       1 Byte          pstrlen         length of pstr // 19
    // 1       19 Bytes        pstr            string identifier of the protocol // "BitTorrent protocol"
    // 20      8 Bytes         reserved        0
    // 28      20 Bytes        info hash       torrentParser.infoHash
    // 48      20 Bytes        peer id         a unique ID for the client
    // 68 Byte Total
    public buildHandshake(torrentParser: TorrentParser) {
        const buf = Buffer.alloc(68)
        // pstrlen, decimal, the length of follow pstr
        buf.writeUInt8(19, 0)
        // pstr
        buf.write("BitTorrent protocol", 1)
        // reserved
        buf.writeUInt32BE(0, 20)
        buf.writeUInt32BE(0, 24)
        // info hash
        torrentParser.infoHash().copy(buf, 28)
        // peer id
        this.client.getId().copy(buf, 48)
        return buf
    }

}
