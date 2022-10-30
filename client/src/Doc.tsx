import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as Y from 'yjs'
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import 'react-quill/dist/quill.bubble.css';
import { QuillBinding } from 'y-quill'
import axios from 'axios';

const quillContainerData = [
    ["bold", "italic", "underline", "strike", "blockquote"],
    [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-4" },
        { indent: "+4" }
    ],
    ["link", "image", "video"],
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


const BASE_URL = "http://localhost:8000"


const Doc = () => {
    const { id } = useParams()

    const [clientID, setClientID] = useState('')

    const quillRef = useRef<ReactQuill>(null)
    const doc = useRef(new Y.Doc())
    const text = doc.current.getText(id)

    const onTextChange = useMemo(() => {
        return () => {
            const update = Y.encodeStateAsUpdate(doc.current)
            const payload = { event: 'update', data: U8AToJSON(update), client_id: clientID }
            axios.post(`${BASE_URL}/op/${id}`, payload)
        }
    }, [clientID, id])

    const withoutObservation = (fn: any) => {
        doc.current.off('update', onTextChange)
        fn()
        doc.current.on('update', onTextChange)
    }

    useEffect(() => {
        if (quillRef.current) {
            const binding = new QuillBinding(doc.current.getText(id), quillRef.current?.editor)
            return () => {
                binding.destroy()
            }
        }
    }, [quillRef])

    useEffect(() => {
        doc.current.on('update', onTextChange)
        return () => {
            doc.current.off('update', onTextChange)
        }
    }, [onTextChange])

    useEffect(() => {
        const eventSource = new EventSource(`${BASE_URL}/connect/${id}`)

        const handleSync = (event: MessageEvent<any>) => {
            const data = JSON.parse(event.data)
            const update = JSONToU8A(data.update)
            setClientID(data.client_id)
            withoutObservation(() => Y.applyUpdate(doc.current, update))
        }

        const handleUpdate = (event: MessageEvent<any>) => {
            const data = JSON.parse(event.data)
            if (data.client_id !== clientID) {
                withoutObservation(() => {
                    const update = JSONToU8A(data.update)
                    Y.applyUpdate(doc.current, update)
                })
            }
        }

        eventSource.addEventListener('update', handleUpdate)
        eventSource.addEventListener('sync', handleSync)

        return () => {
            eventSource.removeEventListener('update', handleUpdate)
            eventSource.removeEventListener('sync', handleSync)
            eventSource.close()
        }
    }, [id])


    return (
        <>
            <div>{`Client ID: ${clientID}`}</div>
            <ReactQuill
                theme="snow"
                modules={{
                    toolbar: {
                        container: quillContainerData,
                    }
                }}
                formats={quillFormats}
                preserveWhitespace={true}
                ref={quillRef}
                onChange={(val, delta) => doc.current.getText(id).applyDelta(delta)}
            />
        </>
    )
}

export function U8AToJSON(buf: Uint8Array) {
    return JSON.stringify(Array.from(buf))
}

export function JSONToU8A(buf: string) {
    return Uint8Array.from(JSON.parse(buf))
}



export default Doc