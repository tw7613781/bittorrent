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

const torrentParser = new TorrentParser("test4.torrent")
torrentParser.show()
// getPeers(torrentParser, (res) => {
//     let i
//     for (i = 0 ; i < res.peers.length; i++) {
//         console.log(res.peers[i].ip, res.peers[i].port)
//     }
// })
