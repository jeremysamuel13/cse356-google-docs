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

    const refCallback = useCallback((quill: ReactQuill) => {
        if (!quill) {
            return
        }
        const editor = quill.getEditor()
        new QuillBinding(doc.current.getText(), editor)
        setRef(quill)
    }, [])

    useEffect(() => {
        if (!ref) { return }

        const handleSync = (event: MessageEvent<any>) => {
            console.debug("SYNC")
            console.debug(event)
            const data = JSON.parse(event.data)
            const update = toUint8Array(data.update)
            setClientID(data.client_id)
            const text = doc.current.getText()
            text.delete(0, text.length)
            Y.applyUpdate(doc.current, update)
        }

        const handleUpdate = (event: MessageEvent<any>) => {
            console.debug("UPDATE")
            console.debug(event)
            const data = JSON.parse(event.data)
            if (data.client_id !== clientID) {
                const update = toUint8Array(data.update)
                Y.applyUpdate(doc.current, update)
            }
        }

        const handlePresence = (event: MessageEvent<any>) => {
            console.log("PRESENCE")
            console.debug(event)
            const { session_id, name, cursor } = JSON.parse(event.data)
            const editor = ref.getEditor()
            console.log({ editor, ref })
            const cursors = editor?.getModule("cursors")
            console.log("CURSORS FROM EDITOR")
            console.log(cursors)
            const randomColor = "#" + ((1 << 24) * Math.random() | 0).toString(16)
            cursors.createCursor(session_id, name, randomColor)
            cursors.moveCursor(session_id, cursor)
            cursors.toggleFlag(session_id, true)

        }

        const eventSource = new EventSource(`/api/connect/${id}`)

        eventSource.addEventListener('sync', handleSync)
        eventSource.addEventListener('presence', handlePresence)
        eventSource.addEventListener('update', handleUpdate)

        return () => {
            eventSource.removeEventListener('update', handleUpdate)
            eventSource.removeEventListener('sync', handleSync)
            eventSource.removeEventListener('presence', handlePresence)
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