// ... add imports and fill in the code
import { Doc, applyUpdate, encodeStateAsUpdate, encodeStateVector, Text } from 'yjs'
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
  cb: CRDTCallback
  text: Text

  constructor(cb: CRDTCallback) {
    ['update', 'insert', 'delete', 'insertImage', 'toHTML'].forEach(f => (this as any)[f] = (this as any)[f].bind(this));

    this.document = new Doc()
    this.cb = cb
    this.text = this.document.getText()
  }

  update(update: string) {
    const data = JSON.parse(update)
    if (data.event === 'sync') {
      this.document = new Doc()
      this.text = this.document.getText()
    }
    applyUpdate(this.document, toUint8Array(data.update))
    if (data.event !== 'sync') {
      const payload = { event: 'update', data: data.update, meta: "FROM CRDT CB" }
      this.cb(JSON.stringify(payload), false)
    }
  }

  insert(index: number, content: string, format: CRDTFormat) {
    const state = encodeStateVector(this.document)
    this.text.insert(index, content, format)

    const update = encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), true)
  }

  delete(index: number, length: number) {
    const state = encodeStateVector(this.document)
    this.text.delete(index, length)

    const update = encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), true)
  }

  insertImage(index: number, url: string) {
    const state = encodeStateVector(this.document)
    this.text.insertEmbed(index, { image: url })

    const update = encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), true)
  }

  toHTML() {
    const converter = new QuillDeltaToHtmlConverter(this.document.getText().toDelta())
    return converter.convert()
  }
};
