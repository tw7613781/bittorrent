import { configure, getLogger } from "log4js"
import { TorrentParser } from "./torrent-parser"
import { getPeers} from "./tracker"

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
    const peers = new Set()

    const manyPromises = urls.map( ( url ) => {
        return new Promise( async (resolve, reject) => {
            try {
                const res = await getPeers(url, torrentParser.infoHash(), torrentParser.size(), 15 * 1000)
                for (const peer of res.peers) {
                    peers.add(peer)
                }
                resolve()
            } catch(e) {
                reject(e)
            }
        })

    })
    Promise.all(manyPromises).then( () => {
        logger.fatal("allPromise.then")
        for (let i = 0 ; i < peers.size; i++) {
            logger.info(`peer ${i} => ${peers[i].ip}:${peers[i].port}`)
        }
    })
}

main().catch((e) => {
    logger.error(e)
})
