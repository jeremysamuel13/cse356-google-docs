import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from "react-router-dom";
import { useCookies } from 'react-cookie'
import axios from 'axios';
import DocElement from './DocElement';

axios.defaults.withCredentials = true


const Home = () => {
  const navigate = useNavigate()
  const [id, setID] = useState('')
  const [createDocName, setCreateDocName] = useState('')
  const [documents, setDocuments] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const data = await axios.get('/collection/list')
    console.log(data)
    if (data.data.error) {
      navigate("/login")
    } else {
      setDocuments(data.data)
    }
  }

  const handleCreateDocument = async () => {
    await axios.post('/collection/create', { name: createDocName })
    await fetchData()
  }

  return (
    <div>
      <div>
        <div>
          {'Room ID: '}
          <input type={"text"} value={id} onChange={(e) => setID(e.target.value.replace(/\s/g, ''))}></input>
        </div>
        <button onClick={() => {
          if (id.trim()) {
            navigate(`/doc/${id.trim()}`)
          }
        }}>Go to room</button>
      </div>

      <div>
        {'Document ID: '}
        <input type={"text"} value={createDocName} onChange={(e) => setCreateDocName(e.target.value.replace(/\s/g, ''))}></input>
        <button onClick={handleCreateDocument}>Create Document</button>
      </div>

      <ul>
        {
          documents.map(doc => <li><DocElement document={doc} onDiscard={fetchData} /></li>)
        }
      </ul>
    </div>
  )
}

export default Home