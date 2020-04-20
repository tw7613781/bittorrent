import { BLOCK_LEN, TorrentParser } from "./torrent-parser"

export class Queue {
    public choked: boolean
    private tp: TorrentParser
    private q
    constructor(tp: TorrentParser) {
        this.tp = tp
        this.q = []
        this.choked = true
    }

    public queue(pieceIndex) {
        const nBlocks = this.tp.blocksPerPiece(pieceIndex)
        for (let i = 0; i < nBlocks; i++) {
            const pieceBlock = {
                index: pieceIndex,
                // tslint:disable-next-line: object-literal-sort-keys
                begin: i * BLOCK_LEN,
                length: this.tp.blockLen(pieceIndex, i),
            }
            this.q.push(pieceBlock)
        }
    }

    public deque() {
        return this.q.shift()
    }

    public peek() {
        return this.q[0]
    }

    public length() {
        return this.q.length
    }
}
