import React, { useEffect, useState } from 'react'

async function mockFetch(data, delay = 400) {
  await new Promise((r) => setTimeout(r, delay))
  return data
}

export function useProjects() {
  return null
}

export function useFetchProjects(mockProjects) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    mockFetch(mockProjects, 600).then((d) => { setData(d); setLoading(false) })
  }, [mockProjects])

  return { data, loading }
}

export function useFetchUsers() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    mockFetch([
      { name: 'Alice', role: 'Designer', avatar: 'A' },
      { name: 'Bob', role: 'Developer', avatar: 'B' },
      { name: 'Carol', role: 'Backend', avatar: 'C' },
      { name: 'Dave', role: 'Fullstack', avatar: 'D' },
      { name: 'Eve', role: 'Mobile', avatar: 'E' },
      { name: 'Frank', role: 'DevOps', avatar: 'F' },
    ], 300).then((d) => { setData(d); setLoading(false) })
  }, [])

  return { data, loading }
}
