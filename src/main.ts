import { configure, getLogger } from "log4js"
import { TorrentParser } from "./torrent-parser"
import { getAllPeers} from "./tracker"

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
    torrentParser.show()
    await getAllPeers(torrentParser)
}

main().catch((e) => {
    logger.error(e)
})
