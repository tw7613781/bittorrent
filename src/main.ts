import { configure, getLogger } from "log4js"
import { TorrentParser } from "./torrent-parser"
import { getPeers} from "./tracker"
import { removeDuplicats } from "./utils"

configure({
    appenders: {
        console: {
            type: "stdout",
        },
        file: {
            filename: `./logs/${new Date().getFullYear()}-${(new Date().getMonth()) + 1}-${new Date().getDate()}/logFile.log`,
            keepFileExt: true,
            maxLogSize: 16777216,
            pattern: ".yyyy-MM-dd",
            type: "dateFile",
        },
    },
    categories: {
        default: { appenders: ["console", "file"], level: "info" },
    },
})
const logger = getLogger("Main")

async function main() {
    const argv = process.argv.slice(2)
    const torrentParser = new TorrentParser(argv[0])
    const urls = torrentParser.urls()
    torrentParser.show()
    logger.fatal(`Get ${urls.length} trarkers, going to request to all of them`)

    const peers = []

    let count = 0
    await new Promise( (resolve) => {
        urls.forEach( async (url) => {
            try {
                const res = await getPeers(url, torrentParser.infoHash(), torrentParser.size(), 15 * 1000)
                for (const peer of res.peers) {
                    peers.push(peer)
                }
            } catch (e) {
                logger.error(e)
            } finally {
                count += 1
                if ( count === urls.length ) {
                    resolve()
                }
            }
        })
    })

    logger.fatal("Get All Peers Info")

    logger.info(`get peers ${peers.length}`)
    const uniquePeers = removeDuplicats(peers)
    logger.info(`unique peers ${uniquePeers.length}`)

    for (let i = 0 ; i < uniquePeers.length; i++) {
        logger.debug(`peer ${i} => ${uniquePeers[i].ip}:${uniquePeers[i].port}`)
    }
}

main().catch((e) => {
    logger.error(e)
})
