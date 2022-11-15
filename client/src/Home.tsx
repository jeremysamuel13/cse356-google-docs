import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from "react-router-dom";
import { useCookies } from 'react-cookie'
import axios from 'axios';


const Home = () => {
  const navigate = useNavigate()
  const [id, setID] = useState('')
  const [documents, setDocuments] = useState<any[]>([])

  useEffect(() => {
    axios.get('/collection/list').then(data => {
      if (data.data.error) {
        navigate("/login")
      } else {
        setDocuments(data.data)
      }
    });
  }, [])

  return (
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

      {
        documents.map(doc => <Link to={`/doc/${doc.id}`}></Link>)
      }
    </div>
  )
}

export default Home