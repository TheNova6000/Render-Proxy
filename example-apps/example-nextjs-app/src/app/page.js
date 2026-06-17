'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

const API = 'https://jsonplaceholder.typicode.com'
const TAG_COLORS = ['#38bdf8','#a78bfa','#34d399','#fbbf24','#fb7185','#67e8f9','#fb923c','#c084fc']

function getTag(userId) {
  const tags = ['React','Node.js','TypeScript','CSS','DevOps','Testing','API','Security']
  return tags[(userId - 1) % tags.length]
}
function getTagColor(tag) {
  const tags = ['React','Node.js','TypeScript','CSS','DevOps','Testing','API','Security']
  return TAG_COLORS[tags.indexOf(tag) % TAG_COLORS.length]
}
function timeAgo(id) {
  const hours = ((id * 7) % 48) + 1
  if (hours < 2) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
function avatarColor(userId) {
  const colors = ['#38bdf8','#a78bfa','#34d399','#fbbf24','#fb7185','#fb923c']
  return colors[(userId - 1) % colors.length]
}
function initials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function ForumPage() {
  const [posts, setPosts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [page, setPage] = useState(1)
  const [openPost, setOpenPost] = useState(null)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [localPosts, setLocalPosts] = useState([])
  const PER_PAGE = 10

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [postsRes, usersRes] = await Promise.all([
        fetch(`${API}/posts`),
        fetch(`${API}/users`)
      ])
      const [postsData, usersData] = await Promise.all([postsRes.json(), usersRes.json()])
      setPosts(postsData)
      setUsers(usersData)
    } catch (e) {
      setError(`Failed to load forum: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const userMap = useMemo(() => {
    const map = {}
    users.forEach(u => { map[u.id] = u })
    return map
  }, [users])

  const allPosts = useMemo(() => [...localPosts, ...posts], [localPosts, posts])

  const filteredPosts = useMemo(() => {
    let result = allPosts
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q))
    }
    if (selectedUser) result = result.filter(p => p.userId === selectedUser)
    if (selectedTag) result = result.filter(p => getTag(p.userId) === selectedTag)
    return result
  }, [allPosts, search, selectedUser, selectedTag])

  const totalPages = Math.ceil(filteredPosts.length / PER_PAGE)
  const pagePosts = filteredPosts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const openPostDetail = useCallback(async (post) => {
    setOpenPost(post)
    setComments([])
    if (post.id < 1000) {
      setCommentsLoading(true)
      try {
        const res = await fetch(`${API}/posts/${post.id}/comments`)
        setComments(await res.json())
      } catch { setComments([]) }
      finally { setCommentsLoading(false) }
    }
  }, [])

  const closePost = useCallback(() => {
    setOpenPost(null)
    setComments([])
  }, [])

  const handleSearch = useCallback((e) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleUserFilter = useCallback((uid) => {
    setSelectedUser(prev => prev === uid ? null : uid)
    setSelectedTag('')
    setPage(1)
  }, [])

  const handleTagFilter = useCallback((tag) => {
    setSelectedTag(prev => prev === tag ? '' : tag)
    setSelectedUser(null)
    setPage(1)
  }, [])

  const submitPost = useCallback(() => {
    if (!newTitle.trim() || !newBody.trim()) return
    const newPost = {
      id: Date.now(),
      userId: 1,
      title: newTitle.trim(),
      body: newBody.trim(),
    }
    setLocalPosts(prev => [newPost, ...prev])
    setNewTitle('')
    setNewBody('')
    setShowCompose(false)
  }, [newTitle, newBody])

  const clearFilters = useCallback(() => {
    setSearch('')
    setSelectedUser(null)
    setSelectedTag('')
    setPage(1)
  }, [])

  const allTags = ['React','Node.js','TypeScript','CSS','DevOps','Testing','API','Security']

  if (error) return (
    <main className="forum-main">
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    </main>
  )

  return (
    <main className="forum-main">
      {/* Toolbar */}
      <div className="forum-toolbar">
        <div className="search-wrap">
          <span className="si">🔍</span>
          <input
            className="forum-search"
            type="text"
            placeholder="Search posts…"
            value={search}
            onChange={handleSearch}
          />
          {search && <button className="clear-btn" onClick={() => { setSearch(''); setPage(1) }}>✕</button>}
        </div>
        <button className="btn-compose" onClick={() => setShowCompose(true)}>+ New Post</button>
      </div>

      {/* Tag filters */}
      <div className="tag-row">
        {allTags.map(tag => (
          <button
            key={tag}
            className={`tag-chip${selectedTag === tag ? ' active' : ''}`}
            style={{ '--tc': getTagColor(tag) }}
            onClick={() => handleTagFilter(tag)}
          >{tag}</button>
        ))}
        {(selectedUser || selectedTag || search) && (
          <button className="clear-filters" onClick={clearFilters}>Clear filters ✕</button>
        )}
      </div>

      <div className="forum-layout">
        {/* Sidebar — users */}
        <aside className="forum-sidebar">
          <div className="sidebar-label">Authors</div>
          {users.map(u => (
            <button
              key={u.id}
              className={`user-btn${selectedUser === u.id ? ' active' : ''}`}
              onClick={() => handleUserFilter(u.id)}
            >
              <span className="avatar" style={{ background: avatarColor(u.id) }}>{initials(u.name)}</span>
              <span className="user-name">{u.name.split(' ')[0]}</span>
            </button>
          ))}
        </aside>

        {/* Post list */}
        <div className="post-list-wrap">
          {loading ? (
            <div className="post-skeletons">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="post-skeleton" />)}
            </div>
          ) : pagePosts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No posts match your filters.</p>
              <button onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <>
              <div className="results-bar">
                <span className="results-label">{filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="post-list">
                {pagePosts.map(post => {
                  const author = userMap[post.userId]
                  const tag = getTag(post.userId)
                  return (
                    <article key={post.id} className="post-card" onClick={() => openPostDetail(post)}>
                      <div className="post-header">
                        {author && (
                          <div className="post-author">
                            <span className="avatar sm" style={{ background: avatarColor(post.userId) }}>{initials(author.name)}</span>
                            <span className="author-name">{author.name}</span>
                          </div>
                        )}
                        <span className="post-time">{timeAgo(post.id)}</span>
                      </div>
                      <h2 className="post-title">{post.title}</h2>
                      <p className="post-excerpt">{post.body.slice(0, 120)}…</p>
                      <div className="post-footer">
                        <span
                          className="post-tag"
                          style={{ color: getTagColor(tag), background: `${getTagColor(tag)}18` }}
                        >{tag}</span>
                        <span className="post-comments">💬 {((post.id * 3) % 12) + 1} replies</span>
                      </div>
                    </article>
                  )
                })}
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span className="page-info">Page {page} / {totalPages}</span>
                  <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Post Detail Drawer */}
      {openPost && (
        <div className="drawer-overlay" onClick={closePost}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                {(() => {
                  const author = userMap[openPost.userId]
                  const tag = getTag(openPost.userId)
                  return author ? (
                    <div className="drawer-meta">
                      <span className="avatar" style={{ background: avatarColor(openPost.userId) }}>{initials(author.name)}</span>
                      <span className="author-name">{author.name}</span>
                      <span className="dot">·</span>
                      <span className="post-time">{timeAgo(openPost.id)}</span>
                      <span className="post-tag" style={{ color: getTagColor(tag), background: `${getTagColor(tag)}18` }}>{tag}</span>
                    </div>
                  ) : null
                })()}
              </div>
              <button className="drawer-close" onClick={closePost}>✕</button>
            </div>
            <h2 className="drawer-title">{openPost.title}</h2>
            <p className="drawer-body">{openPost.body}</p>
            <div className="drawer-section">
              <h3>Comments {!commentsLoading && `(${comments.length})`}</h3>
              {commentsLoading ? (
                <div className="comments-loading">Loading comments…</div>
              ) : comments.length === 0 ? (
                <p className="no-comments">No comments yet.</p>
              ) : (
                <div className="comments-list">
                  {comments.map(c => (
                    <div key={c.id} className="comment">
                      <div className="comment-header">
                        <span className="comment-author">{c.name}</span>
                        <span className="comment-email">{c.email}</span>
                      </div>
                      <p className="comment-body">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="compose-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>New Post</h2>
              <button className="drawer-close" onClick={() => setShowCompose(false)}>✕</button>
            </div>
            <input
              className="compose-input"
              type="text"
              placeholder="Post title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <textarea
              className="compose-textarea"
              placeholder="What's on your mind?"
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={5}
            />
            <div className="compose-actions">
              <button className="btn-cancel" onClick={() => setShowCompose(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitPost} disabled={!newTitle.trim() || !newBody.trim()}>
                Publish Post
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
