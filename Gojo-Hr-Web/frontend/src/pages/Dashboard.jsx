import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Dashboard() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/employees')
        const items = res.data || {}
        setCount(Array.isArray(items) ? items.length : Object.keys(items).length)
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>HR Dashboard</h1>
      <p>Total employees: {count === null ? 'loading...' : count}</p>
    </div>
  )
}
