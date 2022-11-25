// ... add imports and fill in the code
import * as Y from 'yjs'
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import { fromUint8Array, toUint8Array } from 'js-base64';

class CRDTFormat {
  public bold?: Boolean = false;
  public italic?: Boolean = false;
  public underline?: Boolean = false;
};

type CRDTCallback = (update: string, isLocal: Boolean) => void

exports.CRDT = class {

  private document: Y.Doc
  private cb: CRDTCallback
  private text: Y.Text

  constructor(cb: CRDTCallback) {
    this.document = new Y.Doc();
    this.text = this.document.getText();
    this.cb = cb;

    ['update', 'insert', 'delete', 'insertImage', 'toHTML'].forEach(f => (this as any)[f] = (this as any)[f].bind(this));
  }

  update(update: string) {
    const data = JSON.parse(update)
    if (data.event === 'sync') {
      this.document = new Y.Doc()
      this.text = this.document.getText()
    }
    Y.applyUpdate(this.document, toUint8Array(data.update))

    const payload = { event: data.event, data: data.update, meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), false)
  }

  insert(index: number, content: string, format: CRDTFormat) {
    const state = Y.encodeStateVector(this.document)
    this.text.insert(index, content, format)

    const update = Y.encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), true)
  }

  delete(index: number, length: number) {
    const state = Y.encodeStateVector(this.document)
    this.text.delete(index, length)

    const update = Y.encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), true)
  }

  insertImage(index: number, url: string) {
    const state = Y.encodeStateVector(this.document)
    this.text.insertEmbed(index, { image: url })

    const update = Y.encodeStateAsUpdate(this.document, state)
    const payload = { event: 'update', data: fromUint8Array(update), meta: "FROM CRDT CB" }
    this.cb(JSON.stringify(payload), true)
  }

  toHTML() {
    const converter = new QuillDeltaToHtmlConverter(this.text.toDelta())
    return converter.convert()
  }
};
