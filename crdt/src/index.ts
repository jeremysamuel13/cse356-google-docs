// ... add imports and fill in the code
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';


class CRDTFormat {
  public bold?: Boolean = false;
  public italic?: Boolean = false;
  public underline?: Boolean = false;
};

type CRDTCallback = (update: string, isLocal: Boolean) => void

exports.CRDT = class {

  document: Doc
  id: string
  cb: CRDTCallback

  constructor(cb: CRDTCallback) {
    ['update', 'insert', 'delete', 'toHTML'].forEach(f => (this as any)[f] = (this as any)[f].bind(this));

    this.document = new Doc()
    this.id = uuidv4()
    this.cb = cb
  }

  update(update: string) {
    const data = JSON.parse(update)
    const binaryUpdate = JSONToU8A(data.update)
    applyUpdate(this.document, binaryUpdate)
    this.cb(update, false)
  }

  insert(index: number, content: string, format: CRDTFormat) {
    const text = this.document.getText(this.id)
    text.insert(index, content, format)

    const update = encodeStateAsUpdate(this.document)
    const payload = { event: 'update', data: U8AToJSON(update), client_id: this.id }
    this.cb(JSON.stringify(payload), true)

  }

  delete(index: number, length: number) {
    const text = this.document.getText(this.id)
    text.delete(index, length)

    const update = encodeStateAsUpdate(this.document)
    const payload = { event: 'update', data: U8AToJSON(update), client_id: this.id }
    this.cb(JSON.stringify(payload), true)
  }

  toHTML() {
    const config = {}
    const converter = new QuillDeltaToHtmlConverter(this.document.getText(this.id).toDelta(), config)
    return converter.convert()
  }
};

export function U8AToJSON(buf: Uint8Array) {
  return JSON.stringify(Array.from(buf))
}

export function JSONToU8A(buf: string) {
  return Uint8Array.from(JSON.parse(buf))
}

