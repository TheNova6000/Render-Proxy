<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <span class="brand-icon">⬡</span>
        <div>
          <h1>PokeVue</h1>
          <span class="brand-sub">Vue 3 + Render-Proxy Tracer</span>
        </div>
      </div>
      <div class="header-search" :class="{ focused: searchFocused }">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search Pokémon…"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
          @input="onSearch"
        />
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch">✕</button>
      </div>
      <div class="header-right">
        <span class="event-badge">⬡ {{ eventCount }} events</span>
        <button class="fav-toggle" @click="toggleFavView">
          {{ showFavs ? '← All' : `★ Favs (${favorites.length})` }}
        </button>
      </div>
    </header>

    <!-- Type filter bar -->
    <div class="type-bar">
      <button
        v-for="t in typeFilters"
        :key="t.name"
        class="type-chip"
        :class="{ active: selectedType === t.name }"
        :style="{ '--type-color': t.color }"
        @click="selectType(t.name)"
      >
        {{ t.name }}
      </button>
    </div>

    <!-- Main content -->
    <main class="main">
      <!-- Loading skeleton -->
      <div v-if="loading" class="grid skeleton-grid">
        <div v-for="i in 20" :key="i" class="skeleton-card" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>{{ error }}</p>
        <button @click="retry">Try again</button>
      </div>

      <!-- Favorites empty -->
      <div v-else-if="showFavs && favorites.length === 0" class="empty-state">
        <div class="empty-icon">☆</div>
        <p>No favorites yet. Star a Pokémon to save it here.</p>
      </div>

      <!-- Empty search -->
      <div v-else-if="displayPokemon.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No Pokémon match "{{ searchQuery }}"</p>
        <button @click="clearSearch">Clear search</button>
      </div>

      <!-- Grid -->
      <div v-else class="grid">
        <div
          v-for="p in displayPokemon"
          :key="p.id"
          class="poke-card"
          :class="[`bg-${p.types[0]}`]"
          @click="openDetail(p)"
        >
          <button
            class="fav-btn"
            :class="{ active: isFav(p.id) }"
            @click.stop="toggleFav(p)"
            :title="isFav(p.id) ? 'Remove from favorites' : 'Add to favorites'"
          >{{ isFav(p.id) ? '★' : '☆' }}</button>
          <div class="poke-img-wrap">
            <img
              :src="getSpriteUrl(p.id)"
              :alt="p.name"
              loading="lazy"
              @error="onImgError"
            />
          </div>
          <div class="poke-num">#{{ String(p.id).padStart(3, '0') }}</div>
          <div class="poke-name">{{ p.name }}</div>
          <div class="poke-types">
            <span v-for="type in p.types" :key="type" class="type-badge" :class="`type-${type}`">
              {{ type }}
            </span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!showFavs && !searchQuery && !selectedType && totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">← Prev</button>
        <span class="page-info">Page {{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Next →</button>
      </div>
    </main>

    <!-- Pokemon Detail Modal -->
    <Transition name="fade">
      <div v-if="selectedPokemon" class="modal-overlay" @click.self="closeDetail">
        <div class="modal" :class="`modal-${selectedPokemon.types[0]}`">
          <button class="modal-close" @click="closeDetail">✕</button>
          <div class="modal-header">
            <img :src="getSpriteUrl(selectedPokemon.id)" :alt="selectedPokemon.name" class="modal-img" />
            <div class="modal-title">
              <span class="modal-num">#{{ String(selectedPokemon.id).padStart(3, '0') }}</span>
              <h2>{{ selectedPokemon.name }}</h2>
              <div class="poke-types">
                <span v-for="type in selectedPokemon.types" :key="type" class="type-badge" :class="`type-${type}`">{{ type }}</span>
              </div>
            </div>
          </div>
          <div class="modal-body">
            <div v-if="detailLoading" class="detail-loading">Loading details…</div>
            <template v-else-if="detailData">
              <div class="detail-section">
                <h3>Stats</h3>
                <div v-for="stat in detailData.stats" :key="stat.stat.name" class="stat-row">
                  <span class="stat-label">{{ formatStatName(stat.stat.name) }}</span>
                  <div class="stat-bar-wrap">
                    <div class="stat-bar" :style="{ width: `${Math.min((stat.base_stat / 180) * 100, 100)}%` }" />
                  </div>
                  <span class="stat-val">{{ stat.base_stat }}</span>
                </div>
              </div>
              <div class="detail-cols">
                <div class="detail-section">
                  <h3>Abilities</h3>
                  <ul class="ability-list">
                    <li v-for="a in detailData.abilities" :key="a.ability.name" :class="{ hidden: a.is_hidden }">
                      {{ formatName(a.ability.name) }}<span v-if="a.is_hidden" class="hidden-tag">hidden</span>
                    </li>
                  </ul>
                </div>
                <div class="detail-section">
                  <h3>Measurements</h3>
                  <p><strong>Height:</strong> {{ (detailData.height / 10).toFixed(1) }}m</p>
                  <p><strong>Weight:</strong> {{ (detailData.weight / 10).toFixed(1) }}kg</p>
                  <p><strong>Base XP:</strong> {{ detailData.base_experience }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// ─── State ───────────────────────────────────────────────────────────────────
const pokemon = ref([])       // paginated list items with types
const loading = ref(false)
const error = ref(null)
const currentPage = ref(1)
const totalCount = ref(0)
const PER_PAGE = 20

const searchQuery = ref('')
const searchFocused = ref(false)
const searchResults = ref([])
const searchLoading = ref(false)

const selectedType = ref('')
const typeResults = ref([])

const showFavs = ref(false)
const favorites = ref(loadFavorites())

const selectedPokemon = ref(null)
const detailData = ref(null)
const detailLoading = ref(false)

const eventCount = ref(0)

// ─── Type filter config ───────────────────────────────────────────────────────
const typeFilters = [
  { name: 'all',      color: '#8899bb' },
  { name: 'fire',     color: '#fb923c' },
  { name: 'water',    color: '#38bdf8' },
  { name: 'grass',    color: '#34d399' },
  { name: 'electric', color: '#fbbf24' },
  { name: 'psychic',  color: '#f472b6' },
  { name: 'ice',      color: '#67e8f9' },
  { name: 'dragon',   color: '#a78bfa' },
  { name: 'dark',     color: '#94a3b8' },
  { name: 'fighting', color: '#fb7185' },
  { name: 'normal',   color: '#cbd5e1' },
  { name: 'poison',   color: '#c084fc' },
  { name: 'rock',     color: '#d97706' },
  { name: 'ghost',    color: '#818cf8' },
  { name: 'steel',    color: '#9ca3af' },
  { name: 'bug',      color: '#a3e635' },
]

// ─── Computed ─────────────────────────────────────────────────────────────────
const totalPages = computed(() => Math.ceil(totalCount.value / PER_PAGE))

const displayPokemon = computed(() => {
  if (showFavs.value) return favorites.value
  if (searchQuery.value) return searchResults.value
  if (selectedType.value && selectedType.value !== 'all') return typeResults.value
  return pokemon.value
})

// ─── API helpers ─────────────────────────────────────────────────────────────
function getSpriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
}

function getIdFromUrl(url) {
  const parts = url.replace(/\/$/, '').split('/')
  return parseInt(parts[parts.length - 1], 10)
}

async function fetchTypes(url) {
  const res = await fetch(url)
  const data = await res.json()
  return data.types?.map(t => t.type.name) ?? []
}

async function enrichPokemonList(list) {
  return Promise.all(
    list.map(async (item) => {
      const id = getIdFromUrl(item.url)
      try {
        const types = await fetchTypes(`https://pokeapi.co/api/v2/pokemon/${id}`)
        return { id, name: item.name, types }
      } catch {
        return { id, name: item.name, types: ['normal'] }
      }
    })
  )
}

// ─── Data fetching ───────────────────────────────────────────────────────────
async function loadPage(page) {
  loading.value = true
  error.value = null
  try {
    const offset = (page - 1) * PER_PAGE
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${PER_PAGE}&offset=${offset}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    totalCount.value = data.count
    pokemon.value = await enrichPokemonList(data.results)
  } catch (e) {
    error.value = `Failed to load Pokémon: ${e.message}`
  } finally {
    loading.value = false
    eventCount.value++
  }
}

let searchTimer = null
async function onSearch() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) { searchResults.value = []; return }
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${q}`)
      if (res.ok) {
        const data = await res.json()
        searchResults.value = [{
          id: data.id,
          name: data.name,
          types: data.types.map(t => t.type.name)
        }]
      } else {
        // Fuzzy: search from full list
        const allRes = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=1302`)
        const allData = await allRes.json()
        const matched = allData.results.filter(p => p.name.includes(q)).slice(0, 20)
        searchResults.value = await enrichPokemonList(matched)
      }
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
      eventCount.value++
    }
  }, 400)
}

async function selectType(typeName) {
  selectedType.value = typeName
  searchQuery.value = ''
  if (!typeName || typeName === 'all') {
    typeResults.value = []
    return
  }
  loading.value = true
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`)
    const data = await res.json()
    const list = data.pokemon.slice(0, 40).map(p => ({ url: p.pokemon.url, name: p.pokemon.name }))
    typeResults.value = await enrichPokemonList(list)
  } catch (e) {
    error.value = `Failed to load type: ${e.message}`
  } finally {
    loading.value = false
    eventCount.value++
  }
}

async function openDetail(p) {
  selectedPokemon.value = p
  detailData.value = null
  detailLoading.value = true
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.id}`)
    detailData.value = await res.json()
    eventCount.value++
  } catch {
    // ignore — modal still shows without detail
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  selectedPokemon.value = null
  detailData.value = null
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadPage(currentPage.value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadPage(currentPage.value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function retry() {
  error.value = null
  loadPage(currentPage.value)
}

// ─── Favorites ────────────────────────────────────────────────────────────────
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('pokevue_favs') || '[]')
  } catch { return [] }
}

function saveFavorites() {
  localStorage.setItem('pokevue_favs', JSON.stringify(favorites.value))
}

function isFav(id) {
  return favorites.value.some(f => f.id === id)
}

function toggleFav(p) {
  if (isFav(p.id)) {
    favorites.value = favorites.value.filter(f => f.id !== p.id)
  } else {
    favorites.value = [...favorites.value, p]
  }
  saveFavorites()
  eventCount.value++
}

function toggleFavView() {
  showFavs.value = !showFavs.value
  if (!showFavs.value) { selectedType.value = '' }
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
}

function onImgError(e) {
  e.target.style.opacity = '0.3'
}

function formatName(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatStatName(str) {
  const map = { 'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF',
    'special-attack': 'SP.ATK', 'special-defense': 'SP.DEF', 'speed': 'SPD' }
  return map[str] || str.toUpperCase()
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => { loadPage(1) })
</script>

<style>
:root {
  --bg: #07090f;
  --surface: #0d1120;
  --elevated: #111827;
  --card: #0f1928;
  --hover: #152135;
  --border: #1e2d4e;
  --border-b: #2a3f6a;
  --text: #e2e8f0;
  --text-2: #8899bb;
  --text-3: #5a6e94;
  --blue: #38bdf8;
  --purple: #a78bfa;
  --amber: #fbbf24;
  --rose: #fb7185;
  --emerald: #34d399;
  --radius: 12px;
  --radius-sm: 6px;
  --font: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); font-size: 13px; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }

/* ─── Header ─── */
.header {
  display: flex; align-items: center; gap: 14px; padding: 12px 24px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 30;
}
.brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.brand-icon { font-size: 24px; background: linear-gradient(135deg, #38bdf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.brand h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
.brand-sub { font-size: 10px; color: var(--text-3); }
.header-search {
  flex: 1; display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--elevated); transition: border-color .15s;
}
.header-search.focused { border-color: var(--blue); }
.search-icon { font-size: 14px; }
.header-search input { flex: 1; border: none; background: transparent; color: var(--text); font: inherit; font-size: 13px; outline: none; }
.header-search input::placeholder { color: var(--text-3); }
.clear-btn { border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: 12px; }
.header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.event-badge { padding: 4px 10px; border-radius: 20px; background: rgba(56,189,248,.1); border: 1px solid rgba(56,189,248,.25); color: var(--blue); font-size: 11px; font-weight: 600; font-family: monospace; white-space: nowrap; }
.fav-toggle { padding: 7px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; color: var(--text-2); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; transition: all .15s; }
.fav-toggle:hover { border-color: var(--amber); color: var(--amber); }

/* ─── Type bar ─── */
.type-bar {
  display: flex; gap: 6px; padding: 10px 24px;
  overflow-x: auto; background: var(--surface); border-bottom: 1px solid var(--border);
  scrollbar-width: none;
}
.type-bar::-webkit-scrollbar { display: none; }
.type-chip {
  flex-shrink: 0; padding: 4px 12px; border-radius: 20px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-2); font: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer; text-transform: capitalize; transition: all .15s;
}
.type-chip:hover { border-color: var(--type-color); color: var(--type-color); }
.type-chip.active { border-color: var(--type-color); background: color-mix(in srgb, var(--type-color) 15%, transparent); color: var(--type-color); font-weight: 700; }

/* ─── Main ─── */
.main { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }

/* ─── Grid ─── */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.poke-card {
  position: relative; display: flex; flex-direction: column; align-items: center;
  padding: 16px 12px 12px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--card); cursor: pointer; transition: transform .15s, box-shadow .15s, border-color .15s;
  text-align: center;
}
.poke-card:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,.4); border-color: var(--border-b); }
.fav-btn {
  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
  border: none; background: transparent; color: var(--text-3);
  font-size: 14px; cursor: pointer; transition: color .15s; line-height: 1;
}
.fav-btn:hover, .fav-btn.active { color: var(--amber); }
.poke-img-wrap { width: 90px; height: 90px; display: flex; align-items: center; justify-content: center; }
.poke-img-wrap img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,.4)); transition: transform .2s; }
.poke-card:hover .poke-img-wrap img { transform: scale(1.08); }
.poke-num { font-size: 10px; color: var(--text-3); margin-top: 6px; font-family: monospace; }
.poke-name { font-size: 13px; font-weight: 600; text-transform: capitalize; margin: 2px 0 6px; }
.poke-types { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
.type-badge {
  padding: 2px 8px; border-radius: 10px; font-size: 10px;
  font-weight: 700; text-transform: capitalize; letter-spacing: .02em;
}

/* Type badge colors */
.type-fire { background: rgba(251,146,60,.15); color: #fb923c; }
.type-water { background: rgba(56,189,248,.15); color: #38bdf8; }
.type-grass { background: rgba(52,211,153,.15); color: #34d399; }
.type-electric { background: rgba(251,191,36,.15); color: #fbbf24; }
.type-psychic { background: rgba(244,114,182,.15); color: #f472b6; }
.type-ice { background: rgba(103,232,249,.15); color: #67e8f9; }
.type-dragon { background: rgba(167,139,250,.15); color: #a78bfa; }
.type-dark { background: rgba(148,163,184,.15); color: #94a3b8; }
.type-fighting { background: rgba(251,113,133,.15); color: #fb7185; }
.type-normal { background: rgba(203,213,225,.12); color: #cbd5e1; }
.type-poison { background: rgba(192,132,252,.15); color: #c084fc; }
.type-rock { background: rgba(217,119,6,.15); color: #d97706; }
.type-ghost { background: rgba(129,140,248,.15); color: #818cf8; }
.type-steel { background: rgba(156,163,175,.12); color: #9ca3af; }
.type-bug { background: rgba(163,230,53,.15); color: #a3e635; }
.type-ground { background: rgba(234,179,8,.15); color: #eab308; }
.type-flying { background: rgba(147,197,253,.15); color: #93c5fd; }
.type-fairy { background: rgba(251,207,232,.15); color: #fbd38d; }

/* ─── Skeleton ─── */
.skeleton-card { height: 200px; border-radius: var(--radius); background: linear-gradient(90deg, var(--elevated) 25%, var(--hover) 50%, var(--elevated) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

/* ─── Empty / Error ─── */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--text-2); text-align: center; }
.empty-icon { font-size: 40px; opacity: .5; }
.empty-state button { padding: 8px 16px; border: 1px solid var(--border-b); border-radius: var(--radius-sm); background: transparent; color: var(--text-2); font: inherit; font-size: 12px; cursor: pointer; }
.empty-state button:hover { color: var(--text); border-color: var(--blue); }

/* ─── Pagination ─── */
.pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 28px; }
.page-btn { padding: 8px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--elevated); color: var(--text-2); font: inherit; font-size: 12px; cursor: pointer; transition: all .15s; }
.page-btn:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }
.page-btn:disabled { opacity: .3; cursor: not-allowed; }
.page-info { font-size: 12px; color: var(--text-2); }

/* ─── Modal ─── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 50; backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.modal {
  position: relative; width: 90%; max-width: 640px; max-height: 90vh; overflow-y: auto;
  background: var(--surface); border: 1px solid var(--border-b);
  border-radius: var(--radius); padding: 24px;
}
.modal-close { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 6px; background: var(--elevated); color: var(--text-2); cursor: pointer; font-size: 13px; transition: all .15s; }
.modal-close:hover { border-color: var(--rose); color: var(--rose); }
.modal-header { display: flex; gap: 20px; align-items: center; margin-bottom: 20px; }
.modal-img { width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 6px 12px rgba(0,0,0,.5)); }
.modal-title { display: flex; flex-direction: column; gap: 6px; }
.modal-num { font-size: 12px; color: var(--text-3); font-family: monospace; }
.modal-title h2 { font-size: 22px; font-weight: 700; text-transform: capitalize; }
.modal-body { display: flex; flex-direction: column; gap: 18px; }
.detail-loading { text-align: center; color: var(--text-2); padding: 20px; }
.detail-section h3 { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); margin-bottom: 10px; }
.stat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
.stat-label { width: 54px; font-size: 11px; font-weight: 600; color: var(--text-3); flex-shrink: 0; }
.stat-bar-wrap { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.stat-bar { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--blue), var(--purple)); transition: width .4s ease; }
.stat-val { width: 28px; text-align: right; font-size: 11px; font-weight: 600; color: var(--text-2); }
.detail-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.ability-list { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.ability-list li { font-size: 12px; color: var(--text-2); text-transform: capitalize; display: flex; align-items: center; gap: 6px; }
.ability-list li.hidden { color: var(--text-3); }
.hidden-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; background: var(--border); color: var(--text-3); }
.detail-section p { font-size: 12px; color: var(--text-2); margin-bottom: 5px; }
.detail-section strong { color: var(--text); }

/* ─── Transitions ─── */
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
