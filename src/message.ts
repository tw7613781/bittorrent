import { Client } from "./client"
import { TorrentParser } from "./torrent-parser"

export interface IRequest {
    index: number
    begin: number
    length: number
}

export interface IPiece {
    index: number
    begin: number
    block: Buffer
}
export class Message {

    private client: Client
    private torrentParser: TorrentParser

    constructor(client: Client, torrentParser: TorrentParser) {
        this.client = client
        this.torrentParser = torrentParser
    }

    // Offset  Size            Name            Value
    // 0       1 Byte          pstrlen         length of pstr // 19
    // 1       19 Bytes        pstr            string identifier of the protocol // "BitTorrent protocol"
    // 20      8 Bytes         reserved        0
    // 28      20 Bytes        info hash       torrentParser.infoHash
    // 48      20 Bytes        peer id         a unique ID for the client
    // 68 Byte Total
    public buildHandshake() {
        const buf = Buffer.alloc(68)
        // pstrlen, decimal, the length of follow pstr
        buf.writeUInt8(19, 0)
        // pstr
        buf.write("BitTorrent protocol", 1)
        // reserved
        buf.writeUInt32BE(0, 20)
        buf.writeUInt32BE(0, 24)
        // info hash
        this.torrentParser.infoHash().copy(buf, 28)
        // peer id
        this.client.getId().copy(buf, 48)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             0
    // 4       Byte Total
    public buildKeepAlive() {
        return Buffer.alloc(4)
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             1
    // 4       1 Byte          id              0
    // 5       Byte Total
    public buildChoke() {
        const buf = Buffer.alloc(5)
        buf.writeUInt32BE(1, 0)
        buf.writeUInt8(0, 4)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             1
    // 4       1 Byte          id              1
    // 5       Byte Total
    public buildUnchoke() {
        const buf = Buffer.alloc(5)
        buf.writeUInt32BE(1, 0)
        buf.writeUInt8(1, 4)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             1
    // 4       1 Byte          id              2
    // 5       Byte Total
    public buildInterested() {
        const buf = Buffer.alloc(5)
        buf.writeUInt32BE(1, 0)
        buf.writeUInt8(2, 4)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             1
    // 4       1 Byte          id              3
    // 5       Byte Total
    public buildUnInterested() {
        const buf = Buffer.alloc(5)
        buf.writeUInt32BE(1, 0)
        buf.writeUInt8(3, 4)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             5
    // 4       1 Byte          id              4
    // 5       4 Byte          piece-index     zero-based index
    // 9       Byte Total
    public buildHave(payload: number) {
        const buf = Buffer.alloc(9)
        buf.writeUInt32BE(5, 0)
        buf.writeUInt8(4, 4)
        buf.writeUInt32BE(payload, 5)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             palyload.length + 1
    // 4       1 Byte          id              5
    // 5       9 Byte          piece-index     bit-based index
    // 14      Byte Total
    public buildBitfield(bitfield: Buffer) {
        const buf = Buffer.alloc(14)
        buf.writeUInt32BE(bitfield.length + 1, 0)
        buf.writeUInt8(5, 4)
        bitfield.copy(buf, 5)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             13
    // 4       1 Byte          id              6
    // 5       4 Byte          index           integer specifying the zero-based piece index
    // 5       4 Byte          begin           integer specifying the zero-based byte offset within the piece
    // 5       4 Byte          length          integer specifying the requested length.
    // 17      Byte Total
    public buildRequest(payload: IRequest) {
        const buf = Buffer.alloc(17)
        buf.writeUInt32BE(13, 0)
        buf.writeUInt8(6, 4)
        buf.writeUInt32BE(payload.index, 5)
        buf.writeUInt32BE(payload.begin, 9)
        buf.writeUInt32BE(payload.length, 13)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             payload.block.legnth + 13
    // 4       1 Byte          id              7
    // 5       4 Byte          index           integer specifying the zero-based piece index
    // 5       4 Byte          begin           integer specifying the zero-based byte offset within the piece
    // 5       4 Byte          block           block of data, which is a subset of the piece specified by index.
    // 13 + payload.block.length      Byte Total
    public buildPiece(payload: IPiece) {
        const buf = Buffer.alloc(payload.block.length + 13)
        buf.writeUInt32BE(payload.block.length + 9, 0)
        buf.writeUInt8(7, 4)
        buf.writeUInt32BE(payload.index, 5)
        buf.writeUInt32BE(payload.begin, 9)
        payload.block.copy(buf, 13)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             13
    // 4       1 Byte          id              8
    // 5       4 Byte          index           integer specifying the zero-based piece index
    // 5       4 Byte          begin           integer specifying the zero-based byte offset within the piece
    // 5       4 Byte          length          integer specifying the requested length.
    // 17      Byte Total
    public buildCancel(payload: IRequest) {
        const buf = Buffer.alloc(17)
        buf.writeUInt32BE(13, 0)
        buf.writeUInt8(8, 4)
        buf.writeUInt32BE(payload.index, 5)
        buf.writeUInt32BE(payload.begin, 9)
        buf.writeUInt32BE(payload.length, 13)
        return buf
    }

    // Offset  Size            Name            Value
    // 0       4 Byte          len             3
    // 4       1 Byte          id              9
    // 5       2 Byte          port           integer specifying the zero-based piece index
    // 7       Byte Total
    public buildPort(port: number) {
        const buf = Buffer.alloc(7)
        buf.writeUInt32BE(3, 0)
        buf.writeUInt8(9, 4)
        buf.writeUInt16BE(port, 5)
        return buf
      }
}
