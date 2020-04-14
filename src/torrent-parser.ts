import * as bencode from "bencode"
import * as bignum from "bignum"
import * as crypto from "crypto"
import * as fs from "fs"
import { getLogger } from "log4js"

const logger = getLogger("TorrentParser")

export const BLOCK_LEN = Math.pow(2, 14)

export class TorrentParser {
    public torrent: any

    constructor(filepath: string) {
        try {
            this.torrent = bencode.decode(fs.readFileSync(filepath))
        } catch (e) {
            throw new Error(`Read torrent file error: ${e}`)
        }
    }

    public show() {
        // tslint:disable-next-line: forin
        logger.info("Parsing Torrent File...")
        logger.info("key => value")
        if (this.torrent.info.length) {
            // single file
            // tslint:disable-next-line: forin
            for ( const key in this.torrent) {
                const value = this.torrent[key]
                if (key === "creation date") {
                    const creationTime = (new Date(value * 1000)).toLocaleString()
                    logger.info(`${key} => ${creationTime}`)
                } else if (key === "info") {
                    logger.info(`${key} => {}`)
                    const info = value
                    // tslint:disable-next-line: forin
                    for ( const subKey in info) {
                        const subValue = info[subKey]
                        if (subKey === "pieces") {
                            // logger.info(`${subKey} => ${subValue.toString("hex")}`)
                            continue
                        } else if (subKey === "piece length") {
                            logger.info(`${subKey} => ${subValue / 1024} KB`)
                        } else if (subKey === "file") {
                            logger.info(`${subKey} => {}`)
                            const file = info[subKey]
                            // tslint:disable-next-line: forin
                            for (const subsubKey in file) {
                                const subsubValue = file[subsubKey]
                                logger.info(`${subsubKey} => ${subsubValue}`)
                            }
                        } else if (subKey === "length") {
                            logger.info(`${subKey} => ${subValue / 1024} KB`)
                        } else {
                            logger.info(`${subKey} => ${subValue}`)
                        }
                    }
                } else {
                    logger.info(`${key} => ${value}`)
                }
            }
        } else {
            // multiple files
            // tslint:disable-next-line: forin
            for ( const key in this.torrent) {
                const value = this.torrent[key]
                if (key === "creation date") {
                    const creationTime = (new Date(value * 1000)).toLocaleString()
                    logger.info(`${key} => ${creationTime}`)
                } else if (key === "info") {
                    logger.info(`${key} => {}`)
                    const info = value
                    // tslint:disable-next-line: forin
                    for ( const subKey in info) {
                        const subValue = info[subKey]
                        if (subKey === "pieces") {
                            // logger.info(`${subKey} => ${subValue.toString("hex")}`)
                            continue
                        } else if (subKey === "piece length") {
                            logger.info(`${subKey} => ${subValue / 1024} KB`)
                        } else if (subKey === "files") {
                            logger.info(`${subKey} => {}`)
                            const files = subValue
                            for (const file of files) {
                                logger.info("file")
                                // tslint:disable-next-line: forin
                                for (const subsubKey in file) {
                                    const subsubValue = file[subsubKey]
                                    if (subsubKey === "length") {
                                        logger.info(`${subsubKey} => ${subsubValue / 1024} KB`)
                                    } else {
                                        logger.info(`${subsubKey} => ${subsubValue}`)
                                    }
                                }
                            }
                        } else {
                            logger.info(`${subKey} => ${subValue}`)
                        }
                    }
                } else {
                    logger.info(`${key} => ${value}`)
                }
            }
        }
    }

    public url(): string {
        try {
            return this.torrent.announce.toString()
        } catch (e) {
            throw new Error(`Torrent file format incorrect: {e}`)
        }
    }

    public urls(): string[] {
        try {
            const urls = []
            if (this.torrent["announce-list"]) {
                this.torrent["announce-list"].toString().split(",").map( (ele) => {
                    urls.push(ele)
                })
            } else {
                urls.push(this.url())
            }
            return urls
        } catch (e) {
            throw new Error(`Torrent file format incorrect: {e}`)
        }
    }

    // 8 Bytes
    public size(): Buffer {
        const size = this.torrent.info.files ?
        this.torrent.info.files.map( (file) => file.length ).reduce( (a, b) => (a + b) ) : this.torrent.info.length
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

    public pieceLen(pieceIndex) {
        const totalLength = bignum.fromBuffer(this.size()).toNumber()
        const pieceLength = this.torrent.info["piece length"]

        const lastPieceLength = totalLength % pieceLength
        const lastPieceIndex = Math.floor(totalLength / pieceIndex)

        return lastPieceIndex === pieceLength ? lastPieceLength : pieceLength
    }

    public blocksPerPiece(pieceIndex) {
        const pieceLength = this.pieceLen(pieceIndex)
        return Math.ceil( pieceLength / BLOCK_LEN)
    }

    public blockLen(pieceIndex, blockIndex) {
        const pieceLength = this.pieceLen(pieceIndex)
        const lastPieceLength = pieceLength % BLOCK_LEN
        const lastPieceIndex = Math.floor(pieceLength / BLOCK_LEN)

        return blockIndex === lastPieceIndex ? lastPieceLength : BLOCK_LEN
    }
}
