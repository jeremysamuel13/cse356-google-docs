export function U8AToJSON(buf: Uint8Array) {
    return JSON.stringify(Array.from(buf))
}

export function JSONToU8A(buf: string) {
    return Uint8Array.from(JSON.parse(buf))
}