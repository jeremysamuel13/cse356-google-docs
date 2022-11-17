import React from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

axios.defaults.withCredentials = true


interface Document {
    id: string,
    name: string
}

interface Props {
    document: Document,
    onDiscard: any
}

const BASE_URL = "/collection"

const DocElement = ({ document: { id, name }, onDiscard }: Props) => {
    const handleDelete = async () => {
        await axios.post(`${BASE_URL}/delete`, { id })
        onDiscard()
    }

    return (
        <div>
            <Link to={`/edit/${id}`}>{name}</Link>
            <button onClick={handleDelete}>X</button>
        </div>
    )
}

export default DocElement