import { BLOCK_LEN, TorrentParser } from "./torrent-parser"

export class Pieces {

    private requested
    private received
    constructor(tp: TorrentParser) {
        function buildPiecesArray() {
            const nPieces = tp.torrent.info.pieces.length / 20
            const arr = new Array(nPieces).fill(undefined)
            return arr.map( (_, i) => new Array(tp.blocksPerPiece(i)).fill(false) )
        }

        this.requested = buildPiecesArray()
        this.received = buildPiecesArray()
      }

    public addRequested(pieceBlock) {
        const blockIndex = pieceBlock.begin / BLOCK_LEN
        this.requested[pieceBlock.index][blockIndex] = true
    }

    public addReceived(pieceBlock) {
        const blockIndex = pieceBlock.begin / BLOCK_LEN
        this.received[pieceBlock.index][blockIndex] = true
    }

    public needed(pieceBlock) {
        if (this.requested.every( (blocks) => blocks.every( (i) => i))) {
            this.requested = this.received.map( (blocks) => blocks.slice())
          }
        const blockIndex = pieceBlock.begin / BLOCK_LEN
        return !this.requested[pieceBlock.index][blockIndex]
    }

    public isDone() {
        return this.received.every( (blocks) => blocks.every( (i) => i))
    }

    public printPercentDone() {
        const downloaded = this.received.reduce((totalBlocks, blocks) => {
            return blocks.filter( (i) => i).length + totalBlocks
        }, 0)

        const total = this.received.reduce((totalBlocks, blocks) => {
            return blocks.length + totalBlocks
        }, 0)

        const percent = Math.floor(downloaded / total * 100)

        process.stdout.write("progress: " + percent + "%\r")
    }
}
