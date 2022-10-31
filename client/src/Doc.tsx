import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as Y from 'yjs'
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import 'react-quill/dist/quill.bubble.css';
import { QuillBinding } from 'y-quill'
import axios from 'axios';
import { fromUint8Array, toUint8Array } from 'js-base64';



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


const BASE_URL = "/api"


const Doc = () => {
    const { id } = useParams()

    const [clientID, setClientID] = useState('')

    // const quillRef = useRef<ReactQuill>(null)
    const doc = useRef(new Y.Doc())

    const onTextChange = useMemo(() => {
        return async (update: Uint8Array) => {
            const payload = { event: 'update', data: fromUint8Array(update), client_id: clientID }
            console.debug(payload)
            await axios.post(`${BASE_URL}/op/${id}`, payload)
        }
    }, [clientID, id])

    const withoutObservation = (fn: any) => {
        doc.current.off('update', onTextChange)
        fn()
        doc.current.on('update', onTextChange)
    }

    useEffect(() => {
        doc.current.on('update', onTextChange)
        return () => {
            doc.current.off('update', onTextChange)
        }
    }, [onTextChange])

    useEffect(() => {
        const eventSource = new EventSource(`${BASE_URL}/connect/${id}`)

        const handleSync = (event: MessageEvent<any>) => {
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
            console.debug(event)
            const data = JSON.parse(event.data)
            if (data.client_id !== clientID) {
                withoutObservation(() => {
                    const update = toUint8Array(data.update)
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


    if (!clientID) {
        return <>
            Loading...
        </>
    }

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
                ref={ref => {
                    if (ref) {
                        new QuillBinding(doc.current.getText(), ref.getEditor())
                    }
                }}
            />
        </>
    )
}


export default Doc