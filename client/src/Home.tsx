import React, { useState } from 'react'
import { useNavigate } from "react-router-dom";


const Home = () => {
  const navigate = useNavigate()
  const [id, setID] = useState('')

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
    </div>
  )
}

export default Home