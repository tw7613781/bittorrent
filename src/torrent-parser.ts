import * as bencode from "bencode"
import * as bignum from "bignum"
import * as crypto from "crypto"
import * as fs from "fs"

export class TorrentParser {
    public torrent: any

    constructor(filepath: string) {
        this.torrent = bencode.decode(fs.readFileSync(filepath))
    }

    public url(): string {
        try {
            return this.torrent.announce.toString("utf8")
        } catch (e) {
            throw new Error(`Torrent file format incorrect: {e}`)
        }
    }

    // 8 Bytes
    public size(): Buffer {
        const size = this.torrent.info.files ?
        this.torrent.files.map( (file) => file.length ).reduce( (a, b) => (a + b) ) : this.torrent.info.length
        return bignum.toBuffer(size, {size: 8})
    }

    // Sha1 hash outputs 20 Bytes
    public infoHash(): Buffer {
        try {
            const info = bencode.encode(this.torrent.info)
            return crypto.createHash("sha1").update(info).digest()
        } catch (e) {
            throw new Error(`Torrent file format incorrect: {e}`)
        }
    }
}
