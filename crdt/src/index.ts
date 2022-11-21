// ... add imports and fill in the code
import { Doc, applyUpdate, encodeStateAsUpdate, encodeStateVector } from 'yjs'
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import { fromUint8Array, toUint8Array } from 'js-base64';

class CRDTFormat {
  public bold?: Boolean = false;
  public italic?: Boolean = false;
  public underline?: Boolean = false;
};

type CRDTCallback = (update: string, isLocal: Boolean) => void

exports.CRDT = class {

  document: Doc
  clientID: string
  cb: CRDTCallback

  constructor(cb: CRDTCallback) {
    ['update', 'insert', 'delete', 'toHTML'].forEach(f => (this as any)[f] = (this as any)[f].bind(this));

    this.document = new Doc()
    this.cb = cb
    this.clientID = ''
  }

  update(update: string) {
    const data = JSON.parse(update)
    if (data.event === 'sync') {
      this.clientID = data.client_id
      const text = this.document.getText()
      text.delete(0, text.length)
    }
    applyUpdate(this.document, toUint8Array(data.update))
    const payload = { event: 'update', data: data.update, client_id: this.clientID }
    this.cb(JSON.stringify(payload), false)
  }

  insert(index: number, content: string, format: CRDTFormat) {
    const state = encodeStateVector(this.document)
    const text = this.document.getText()
    text.insert(index, content, format)

    const update = encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), client_id: this.clientID }
    this.cb(JSON.stringify(payload), true)
  }

  delete(index: number, length: number) {
    const state = encodeStateVector(this.document)
    const text = this.document.getText()
    text.delete(index, length)

    const update = encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), client_id: this.clientID }
    this.cb(JSON.stringify(payload), true)
  }

  toHTML() {
    const converter = new QuillDeltaToHtmlConverter(this.document.getText().toDelta())
    return converter.convert()
  }

  insertImage(index: number, url: string) {
    const state = encodeStateVector(this.document)
    const text = this.document.getText()
    text.insertEmbed(index, { image: url })
    console.log("Embedded image?")

    const update = encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), client_id: this.clientID }
    this.cb(JSON.stringify(payload), true)
  }
};
