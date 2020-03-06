import * as crypto from "crypto"

let id: Buffer
// GL stands for Glosfer, 0001 is the version
const clientName = "-GL0001-"

export function getId() {
    if (id === undefined) {
        id = crypto.randomBytes(20)
        Buffer.from(clientName).copy(id, 0)
    }
    return id
}

export function group(buf: Buffer, groupSize): Buffer[] {
    const groups = []
    let i
    for (i = 0; i < buf.length; i + groupSize) {
        groups.push(buf.slice(i, i + groupSize))
    }
    return groups
}
