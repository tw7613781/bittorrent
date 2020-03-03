import * as bencode from "bencode"
import * as fs from "fs"

const torrent = bencode.decode(fs.readFileSync("test.torrent"))
console.log(torrent.announce.toString("utf8"))
