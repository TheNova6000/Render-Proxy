import React from 'react'

function handleSearch() {
  fetch('/api/search')
}

const handleClick = () => {
  console.log('clicked')
  fetch('/api/click')
}

export default function Sample() {
  return (
    <div>
      <button onClick={handleClick}>Click</button>
      <button onClick={() => handleSearch()}>Search</button>
    </div>
  )
}
