import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as Y from 'yjs'
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import 'react-quill/dist/quill.bubble.css';
import { QuillBinding } from 'y-quill'
import { toUint8Array } from 'js-base64';
import QuillCursors from 'quill-cursors';

Quill.register('modules/cursors', QuillCursors)


const quillContainerData = [
    ["bold", "italic", "underline", "strike", "blockquote"],
    [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-4" },
        { indent: "+4" }
    ],
    ["image"],
    ["clean"],
];

const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    "bullet",
    "indent",
    "link",
    "image",
    "video",
];

const modules = {
    cursors: true,
    toolbar: {
        container: quillContainerData,
    }
}


const ReadOnlyDoc = () => {
    const { id } = useParams()

    const [clientID, setClientID] = useState('')
    const [ref, setRef] = useState<ReactQuill | null>(null)
    const doc = useRef(new Y.Doc())
    const binding = useRef<QuillBinding>(null!!)

    const refCallback = useCallback((quill: ReactQuill) => {
        if (!quill) {
            return
        }
        setRef(quill)
    }, [])


    useEffect(() => {
        if (!ref) { return }

        const eventSource = new EventSource(`/api/connect/${id}`)

        const handleUpdate = (event: MessageEvent<any>) => {
            console.debug("UPDATE")
            console.debug(event)
            const data = JSON.parse(event.data)
            const update = toUint8Array(data.update)
            Y.applyUpdate(doc.current, update)
            Y.logUpdate(update)
        }

        const handlePresence = (event: MessageEvent<any>) => {
            console.log("PRESENCE")
            console.debug(event)
            const { client_id, name, cursor } = JSON.parse(event.data)
            const editor = ref.getEditor()
            console.log({ editor, ref })
            const cursors = editor?.getModule("cursors")
            console.log("CURSORS FROM EDITOR")
            console.log(cursors)
            const randomColor = "#" + ((1 << 24) * Math.random() | 0).toString(16)

            cursors.createCursor(client_id, name, randomColor)
            cursors.moveCursor(client_id, cursor)
            cursors.toggleFlag(client_id, true)
        }

        const handleSync = (event: MessageEvent<any>) => {
            console.debug("SYNC")
            console.debug(event)
            const data = JSON.parse(event.data)
            const update = toUint8Array(data.update)
            setClientID(data.client_id)

            binding.current?.destroy()
            doc.current = new Y.Doc()
            Y.applyUpdate(doc.current, update)
            const editor = ref.getEditor()
            binding.current = new QuillBinding(doc.current.getText(), editor)
            console.log("DONE WITH SYNC")
        }

        eventSource.addEventListener('update', handleUpdate)
        eventSource.addEventListener('presence', handlePresence)
        eventSource.addEventListener('sync', handleSync)

        return () => {
            eventSource.removeEventListener('update', handleSync)
            eventSource.removeEventListener('presence', handlePresence)
            eventSource.removeEventListener('sync', handlePresence)
            eventSource.close()
        }
    }, [ref])

    return (
        <>
            <div>{`Client ID: ${clientID}`}</div>
            <ReactQuill
                theme="snow"
                modules={modules}
                formats={quillFormats}
                preserveWhitespace={true}
                ref={refCallback}
                readOnly={true}
            />
        </>
    )
}


export default ReadOnlyDoc

