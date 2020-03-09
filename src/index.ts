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

const argv = process.argv.slice(2)
const torrentParser = new TorrentParser(argv[0])
torrentParser.show()
getPeers(torrentParser, (res) => {
    let i
    for (i = 0 ; i < res.peers.length; i++) {
        logger.info(`peer ${i} => ${res.peers[i].ip}:${res.peers[i].port}`)
    }
})
