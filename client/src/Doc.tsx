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


const Doc = () => {
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

    const onTextChange = useCallback(async (update: Uint8Array) => {
        console.log({ update })
        const payload = { event: 'update', data: fromUint8Array(update), client_id: clientID }
        console.debug(payload)
        await axios.post(`/api/op/${id}`, payload)
    }, [clientID])

    useEffect(() => {
        doc.current.on('update', onTextChange)

        return () => {
            doc.current.off('update', onTextChange)
        }
    }, [onTextChange])

    useEffect(() => {
        if (!ref) { return }

        const handleSync = (event: MessageEvent<any>) => {
            console.debug("SYNC")
            console.debug(event)
            const data = JSON.parse(event.data)
            const update = toUint8Array(data.update)
            setClientID(data.client_id)
            withoutObservation(() => {
                const text = doc.current.getText()
                text.delete(0, text.length)
                Y.applyUpdate(doc.current, update)
            })
        }

        const handleUpdate = (event: MessageEvent<any>) => {
            console.debug("UPDATE")
            console.debug(event)
            const data = JSON.parse(event.data)
            if (data.client_id !== clientID) {
                withoutObservation(() => {
                    const update = toUint8Array(data.update)
                    Y.applyUpdate(doc.current, update)
                })
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


    // // useEffect(() => {
    // //     console.log(`REF USEEFFECT: ${!!ref}`)
    // //     if (ref) {
    // //         const handlePresence = (event: MessageEvent<any>) => {
    // //             console.debug(event)
    // //             const { session_id, client_id, name, cursor } = JSON.parse(event.data)
    // //             if (client_id !== clientID) {
    // //                 console.log("PRESENCE")
    // //                 const editor = ref.getEditor()
    // //                 const cursors = editor?.getModule("cursors")
    // //                 console.log("CURSORS FROM EDITOR")
    // //                 console.log(cursors)
    // //                 const randomColor = "#" + ((1 << 24) * Math.random() | 0).toString(16)
    // //                 cursors.createCursor(session_id, name, randomColor)
    // //                 cursors.moveCursor(id, cursor)
    // //                 cursors.toggleFlag(id, true)
    // //             }
    // //         }

    // //         eventSource.current.addEventListener('presence', handlePresence)

    // //         return () => {
    // //             eventSource.current.removeEventListener('presence', handlePresence)
    // //         }

    // //     }
    // // }, [ref])

    const withoutObservation = (fn: any) => {
        doc.current.off('update', onTextChange)
        fn()
        doc.current.on('update', onTextChange)
    }


    const handleSelectionChange = async (cursor: Cursor) => {
        await axios.post(`/api/presence/${id}`, { ...cursor, client_id: clientID })
    }

    // if (!clientID) {
    //     return <>
    //         Loading...
    //     </>
    // }

    return (
        <>
            <div>{`Client ID: ${clientID}`}</div>
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