import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as Y from 'yjs'
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import 'react-quill/dist/quill.bubble.css';
import { QuillBinding } from 'y-quill'
import axios from 'axios';
import { fromUint8Array, toUint8Array } from 'js-base64';
import QuillCursors from 'quill-cursors';

//@ts-ignore
import ImageUploader from 'quill-image-uploader'

Quill.register('modules/cursors', QuillCursors)
Quill.register("modules/imageUploader", ImageUploader);

axios.defaults.withCredentials = true

interface Cursor {
    index: number,
    length: number
}

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

const handleImage = async (image: File) => {
    const formData = new FormData()
    formData.append("file", image)
    const res = await axios.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
    return `${window.location.origin}/media/access/${res.data.mediaid}`
}

const modules = {
    cursors: true,
    toolbar: {
        container: quillContainerData,
    },
    imageUploader: {
        upload: handleImage
    }
}

const onTextChange = (id: string | undefined) => (async (update: Uint8Array) => {
    await axios.post(`/api/op/${id}`, {data: fromUint8Array(update)})
})


const Doc = () => {
    const { id } = useParams()

    const [connected, setConnected] = useState(false)
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
            doc.current._observers.delete('update')
            const update = toUint8Array(event.data)
            Y.applyUpdate(doc.current, update)
            doc.current.on('update', onTextChange(id))
        }

        const handlePresence = (event: MessageEvent<any>) => {
            console.log("PRESENCE")
            console.debug(event)
            const { session_id, name, cursor } = JSON.parse(event.data)
            const editor = ref.getEditor()
            const cursors = editor?.getModule("cursors")
            const randomColor = "#" + ((1 << 24) * Math.random() | 0).toString(16)

            cursors.createCursor(session_id, name, randomColor)
            cursors.moveCursor(session_id, cursor)
            cursors.toggleFlag(session_id, cursor?.index && cursor?.length)
        }

        const handleSync = (event: MessageEvent<any>) => {
            setConnected(true)

            console.debug("SYNC")
            console.debug(event)
            const update = toUint8Array(event.data)
            doc.current._observers.delete('update')
            binding.current?.destroy()
            doc.current = new Y.Doc()
            Y.applyUpdate(doc.current, update)
            const editor = ref.getEditor()
            binding.current = new QuillBinding(doc.current.getText(), editor)
            doc.current.on('update', onTextChange(id))
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


    const handleSelectionChange = async (cursor: Cursor) => {
        await axios.post(`/api/presence/${id}`, cursor)
    }

    return (
        <>
            <>Connected: {connected}</>
            <ReactQuill
                theme="snow"
                modules={modules}
                onChangeSelection={handleSelectionChange}
                formats={quillFormats}
                preserveWhitespace={true}
                ref={refCallback}
            />

        </>
    )
}


export default Doc