import { TorrentParser } from "./torrent-parser"
import { getPeers} from "./tracker"

const torrentParser = new TorrentParser("test.torrent")
getPeers(torrentParser, (res) => {
    let i
    for (i = 0 ; i < res.peers.length; i++) {
        console.log(res.peers[i].ip, res.peers[i].port)
    }
})
