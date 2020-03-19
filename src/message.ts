import { TorrentParser } from "./torrent-parser"
import { getId } from "./utils"

export class Message {

    // Offset  Size            Name            Value
    // 0       1 Byte          pstrlen         length of pstr // 19
    // 1       19 Byte         pstr            string identifier of the protocol // "BitTorrent protocol"
    // 8       64-bit integer  connection_id
    // 16 Byte Total
    // In version 1.0 of the BitTorrent protocol, pstrlen = 19, and pstr = "BitTorrent protocol".
    public static buildHandshake(torrentParser: TorrentParser) {
        const buf = Buffer.alloc(68)
        // pstrlen, decimal, the length of follow pstr
        buf.writeUInt8(19, 0)
        // pstr
        buf.write("BitTorrent protocol", 1);
        // reserved
        buf.writeUInt32BE(0, 20)
        buf.writeUInt32BE(0, 24)
        // info hash
        torrentParser.infoHash().copy(buf, 28)
        // peer id
        buf.write(getId())
        return buf
    }
}