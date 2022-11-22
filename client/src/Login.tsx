import React, { useState } from 'react'
import { useNavigate } from "react-router-dom";
import { useCookies } from 'react-cookie'
import axios from 'axios';

axios.defaults.withCredentials = true

const DEFAULT_LOGIN = {
    email: "miteray729@lidely.com",
    password: "aNtdkUpyFx9JMBpZhl0T"
}

const Login = () => {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    return (
        //Login
        <div>
            Email: <input type={"text"} value={email} onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}></input>
            Password: <input type={"text"} value={password} onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}></input>

            <button onClick={() => {
                setEmail(DEFAULT_LOGIN.email)
                setPassword(DEFAULT_LOGIN.password)
            }}>Set Example Login</button>

            <button onClick={() => {
                axios.post('/users/login', { email, password }).then(() => navigate('/home'))
            }}>Login</button>
        </div>
    )
}

export default Login